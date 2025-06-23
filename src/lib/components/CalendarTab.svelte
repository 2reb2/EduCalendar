<script>
    import { onMount } from 'svelte';
    import courses from '$lib/stores/courses.js';
    import { eventsStore } from '$lib/stores/events.js';
    import { db, auth } from '$lib/firebase';
    import { doc, updateDoc, getDocs, collection, query, where, orderBy } from 'firebase/firestore';

    import { Calendar, TimeGrid, DayGrid, List, Interaction } from '@event-calendar/core';

    import { fade } from 'svelte/transition';

    function formatTimeForFirestore(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}:00`;
    }

    async function refreshEvents() {
        // console.log('refreshEvents called');
        if (!auth.currentUser) return;
        
        // Fetch events
        const eventsQuery = query(
            collection(db, 'events'),
            where('userId', '==', auth.currentUser.uid),
            orderBy('startDate')
        );
        const eventsSnapshot = await getDocs(eventsQuery);
        const events = eventsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Fetch courses and create class events
        const coursesQuery = query(
            collection(db, 'courses'),
            where('userId', '==', auth.currentUser.uid)
        );
        const coursesSnapshot = await getDocs(coursesQuery);
        const courses = coursesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        // Generate class events from course schedules
        const classEvents = courses.flatMap(course => {
            if (!course.schedule) return [];
            
            return course.schedule.flatMap(session => {
                if (!session.day || !session.start || !session.end) return [];
                
                const dayMap = {
                    'sunday': 0, 'monday': 1, 'tuesday': 2, 
                    'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
                };
                const dayNumber = dayMap[session.day.toLowerCase()];
                if (dayNumber === undefined) return [];

                // Create recurring event for each class session
                return {
                    id: `class-${course.id}-${session.day}`,
                    title: `${course.title} Class`,
                    startTime: session.start,
                    endTime: session.end,
                    location: session.location || '',
                    color: course.color,
                    isRecurring: true,
                    recurrencePattern: session.day.toLowerCase(),
                    startDate: course.createdAt?.toDate().toISOString().split('T')[0] || new Date().toISOString().split('T')[0], 
                    courseTitle: course.title,
                    isClass: true,
                    courseId: course.id
                };
            });
        });
        // console.log('Regular events:', events);
        // console.log('Courses:', courses);
        // console.log('Generated classEvents:', classEvents);

        // Combine regular events with class events
        const allEvents = [...events, ...classEvents];
        // console.log('All events before setting store:', allEvents);
        eventsStore.set(allEvents);
    }

    // eventDetailsModal start
    import EventDetailModal from '$lib/components/EventDetailModal.svelte';

    let selectedEvent = null;
    let isModalOpen = false;

    function openModal(event) {
        selectedEvent = event;
        isModalOpen = true;
    }

    function closeModal() {
        isModalOpen = false;
        selectedEvent = null;
    }
    // eventDetailModal end

    let options = {
        height: '100%',
        plugins: [Interaction],
        headerToolbar: {
            start: 'title',
            center: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
            end: 'today prev,next'
        },
        views: {
            dayGridMonth: {
                titleFormat: { year: 'numeric', month: 'long' }
            },
            timeGridWeek: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
            },
            timeGridDay: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
            },
            listWeek: {
                titleFormat: { year: 'numeric', month: 'short', day: 'numeric' }
            }
        },
        initialView: 'timeGridWeek',
        firstDay: 1,
        nowIndicator: true,
        scrollTime: new Date().toTimeString().slice(0, 8),
        events: [],
        dragScroll: true,
        eventDragMinDistance: 5,
        eventLongPressDelay: 1000,
        eventClick: function(info) {
            // Open the modal with the clicked event data
            openModal(info.event.extendedProps);
        }
    };

    let calendarRef;

    let showViewDropdown = false;
    let dropdownPosition = { top: 0, left: 0 };
    let currentView = 'timeGridWeek'; // Track current view

    // Modify the changeView function to track current view
    function changeView(view) {
        currentView = view;
        if (calendarRef) {
            calendarRef.setOption('view', view);
            // Update button text label if in mobile view
            if (mobileView) {
                calendarRef.setOption('customButtons', {
                    dropdownTrigger: {
                        text: getViewName(view),
                        click: function(e) {
                            const rect = e.target.getBoundingClientRect();
                            dropdownPosition = {
                                top: rect.bottom + window.scrollY,
                                left: rect.left + window.scrollX
                            };
                            showViewDropdown = !showViewDropdown;
                        }
                    }
                });
            }
        }
        showViewDropdown = false; // Close dropdown after selection
    }

    // Update the mobile detection to be reactive
    let mobileView = false;
    
    function checkMobile() {
        mobileView = typeof window !== 'undefined' && window.innerWidth < 768;
    }

    // Enhanced updateToolbar function
    function updateToolbar() {
        checkMobile();
        
        if (mobileView) {
            options.headerToolbar = {
                start: 'title',
                center: 'dropdownTrigger',
                end: 'today prev,next'
            };
            
            // Add custom dropdown trigger button
            options.customButtons = {
                dropdownTrigger: {
                    text: getViewName(currentView),
                    click: function(e) {
                        const rect = e.target.getBoundingClientRect();
                        dropdownPosition = {
                            top: rect.bottom + window.scrollY,
                            left: rect.left + window.scrollX
                        };
                        showViewDropdown = !showViewDropdown;
                    }
                }
            };
        } else {
            options.headerToolbar = {
                start: 'title',
                center: 'dayGridMonth,timeGridWeek,timeGridDay,listWeek',
                end: 'today prev,next'
            };
            options.customButtons = {};
            showViewDropdown = false;
        }
        
        if (calendarRef) {
            calendarRef.setOption('headerToolbar', options.headerToolbar);
            calendarRef.setOption('customButtons', options.customButtons);
        }
    }

    // Helper function to get view name
    function getViewName(view) {
        switch(view) {
            case 'dayGridMonth': return 'Month';
            case 'timeGridWeek': return 'Week';
            case 'timeGridDay': return 'Day';
            case 'listWeek': return 'List';
            default: return 'View';
        }
    }

    onMount(() => {
        if (calendarRef) {
            calendarRef.setOption('view', currentView);
        }
        refreshEvents();
        checkMobile();
        updateToolbar();
        
        window.addEventListener('resize', updateToolbar);
        
        return () => {
            unsubscribeEvents();
            window.removeEventListener('resize', updateToolbar);
        };
    });

    // Subscribe to eventsStore to update calendar
    const unsubscribeEvents = eventsStore.subscribe(events => {
        // console.log('eventsStore updated', events);
        if (!events) {
            // console.log('No events in store');
            return;
        }

        const expandedEvents = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Show events for 1 year 
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);

        events.forEach(event => {
            // Skip invalid events
            if ((!event.startDate && !event.isRecurring) || 
                (event.startDate && isNaN(new Date(event.startDate).getTime()))) {
                // console.error('Invalid event:', event);
                return;
            }

            // For class events (recurring based on schedule)
            if (event.isClass) {
                let currentDate = new Date(event.startDate); 
                currentDate.setHours(0, 0, 0, 0);
                            
                while (currentDate <= endDate) {
                    if (matchesRecurrencePattern(currentDate, event.recurrencePattern)) {
                        const instance = createCalendarEvent(event, currentDate);
                        // console.log('Generated class event:', instance);
                        if (instance) expandedEvents.push(instance);
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            // For recurring all-day events
            else if (event.isRecurring && event.allDay) {
                let currentDate = new Date(event.startDate);
                
                while (currentDate <= endDate) {
                    if (matchesRecurrencePattern(currentDate, event.recurrencePattern)) {
                        const instance = createCalendarEvent(event, currentDate);
                        if (instance) expandedEvents.push(instance);
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            }
            // For other recurring events
            else if (event.isRecurring && event.recurrencePattern) {
                let currentDate = event.startDate ? new Date(event.startDate) : new Date(today);
                
                // Skip the original date if it doesn't match the pattern
                if (!matchesRecurrencePattern(currentDate, event.recurrencePattern)) {
                    currentDate.setDate(currentDate.getDate() + 1);
                }

                while (currentDate <= endDate) {
                    if (matchesRecurrencePattern(currentDate, event.recurrencePattern)) {
                        const instance = createCalendarEvent(event, currentDate);
                        if (instance) expandedEvents.push(instance);
                    }
                    currentDate.setDate(currentDate.getDate() + 1);
                }
            } 
            // For non-recurring events
            else {
                const baseEvent = createCalendarEvent(event);
                if (baseEvent) expandedEvents.push(baseEvent);
            }
        });

        // console.log("Generated expanded events:", expandedEvents); //debug
        options.events = expandedEvents;
        if (calendarRef) calendarRef.setOption('events', expandedEvents);
    });

    // Helper function to check if a date matches the recurrence pattern
    function matchesRecurrencePattern(date, pattern) {
        const dayMap = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 
            'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
        };

        if (dayMap.hasOwnProperty(pattern.toLowerCase())) {
            const targetDay = dayMap[pattern.toLowerCase()];
            return date.getDay() === targetDay;
        }

        const day = date.getDay();
        switch (pattern) {
            case 'daily':
                return true;
            case 'weekday':
                return day >= 1 && day <= 5; // Monday to Friday
            case 'weekend':
                return day === 0 || day === 6; // Saturday/Sunday
            case 'monday':
                return day === 1;
            case 'tuesday':
                return day === 2;
            case 'wednesday':
                return day === 3;
            case 'thursday':
                return day === 4;
            case 'friday':
                return day === 5;
            case 'saturday':
                return day === 6;
            case 'sunday':
                return day === 0;
            default:
                return false;
        }
    }

    // Create a calendar event object
    function createCalendarEvent(event, specificDate = null) {
        try {
            let start, end;
            const useDate = specificDate ? specificDate : new Date(event.startDate);

            let title = event.title;
            if (event.isRecurring && !event.isClass) {
                title = `🔁 ${title}`;
            } else if (event.isClass) {
                title = `👨‍🏫 ${title}`;
            }
            if (event.location) {
                title += ` , at ${event.location}`;
            }

            if (isNaN(useDate.getTime())) {
                // console.error('Invalid date for event:', event);
                return null;
            }

            // Check if past the end date for recurring events
            if (event.endDate && specificDate) {
                const endDate = new Date(event.endDate);
                endDate.setHours(23, 59, 59, 999); // Include the entire end date
                if (specificDate > endDate) {
                    return null; // Skip dates after the end date
                }
            }

            // Handle class events differently
            if (event.isClass) {
                // Parse time (format like "18:00")
                const [startHours, startMinutes] = event.startTime.split(':').map(Number);
                const [endHours, endMinutes] = event.endTime.split(':').map(Number);
                if (isNaN(startHours) || isNaN(endHours)) { 
                    // console.error('Invalid class time:', event.startTime, event.endTime);
                    return null;
                }
                // else {console.log('startHours', startHours)}
                
                // Find the next occurrence of this day of week
                const dayMap = {
                    'sunday': 0, 'monday': 1, 'tuesday': 2, 
                    'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
                };
                const targetDay = dayMap[event.recurrencePattern];
                
                // Calculate days until next occurrence
                const daysUntilNext = (targetDay + 7 - useDate.getDay()) % 7;
                const nextDate = new Date(useDate);
                nextDate.setDate(useDate.getDate() + daysUntilNext);
                
                // Set the time on the specific date
                start = new Date(nextDate);
                start.setHours(startHours, startMinutes, 0, 0);
                
                end = new Date(nextDate);
                end.setHours(endHours, endMinutes, 0, 0);
                
                // If end time is before start time (ard midnight), add a day
                if (end < start) {
                    end.setDate(end.getDate() + 1);
                }
            }
            // Handle all-day events (both single and recurring)
            else if (event.allDay) {
                // For recurring all-day events, only show on matching days
                if (event.isRecurring && specificDate) {
                    if (!matchesRecurrencePattern(specificDate, event.recurrencePattern)) {
                        return null; // Skip non-matching days
                    }
                    start = new Date(specificDate);
                    start.setHours(0, 0, 0, 0);
                    end = new Date(specificDate);
                    end.setHours(23, 59, 59, 999);
                } 
                // Single all-day event or first occurrence of recurring
                else {
                    start = new Date(event.startDate);
                    start.setHours(0, 0, 0, 0);
                    end = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
                    end.setHours(23, 59, 59, 999);
                }
            }
            // Handle regular events
            else if (event.allDay || !event.startTime || !event.endTime) {
                start = new Date(useDate);
                end = event.endDate ? new Date(event.endDate) : new Date(useDate);
                
                // All-day events should end at 23:59:59
                if (event.allDay && end) {
                    end.setHours(23, 59, 59, 999);
                }
            } else {
                // Handle timed events
                const startDateStr = useDate.toISOString().split('T')[0];
                const startTime = event.startTime || '00:00';
                const endTime = event.endTime || '23:59';
                
                start = new Date(`${startDateStr}T${startTime}`);
                end = new Date(`${startDateStr}T${endTime}`);
                
                // If end time is before start time, adjust to next day
                if (end < start) {
                    end.setDate(end.getDate() + 1);
                }
            }

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                // console.error('Invalid date/time for event:', event);
                return null;
            }

            return {
                id: `${event.id}-${specificDate ? specificDate.getTime() : ''}`,
                title, //: event.title + (event.location ? ` (${event.location})` : ''),
                start,
                end,
                allDay: event.allDay || false,
                color: event.color || '#3b82f6',
                extendedProps: {
                    ...event,
                    isRecurringInstance: !!specificDate,
                    originalEventId: event.id
                }
            };
        } catch (error) {
            // console.error('Error creating calendar event:', error, event);
            return null;
        }
    }

    function handleDropdownKeydown(e) {
        if (e.key === 'Escape') {
            showViewDropdown = false;
        }
    }
</script>

<div class="h-full">
    <Calendar
        bind:this={calendarRef}
        plugins={[TimeGrid, DayGrid, List, Interaction]}
        {options}
        class="flex-1"
    />
    <!-- View dropdown menu -->
    {#if mobileView && showViewDropdown}
    <div 
        class="calendar-dropdown bg-white shadow-lg rounded-md z-100 py-1 border border-gray-200"
        style={`top: ${dropdownPosition.top}px; left: ${dropdownPosition.left}px`}
        role="menu"
        tabindex="0"
        aria-orientation="vertical"
        aria-labelledby="view-dropdown-label"
        on:click|stopPropagation
        on:keydown|stopPropagation={handleDropdownKeydown}
    >
        <button 
            type="button"
            class="block w-full text-left px-4 py-2 hover:bg-gray-100 {currentView === 'timeGridDay' ? 'bg-blue-50 text-blue-600' : ''}"
            on:click={() => changeView('timeGridDay')}
            on:keydown={e => e.key === 'Enter' && changeView('timeGridDay')}
            role="menuitem"
        >
            Day
        </button>
        <button 
            type="button"
            class="block w-full text-left px-4 py-2 hover:bg-gray-100 {currentView === 'timeGridWeek' ? 'bg-blue-50 text-blue-600' : ''}"
            on:click={() => changeView('timeGridWeek')}
            on:keydown={e => e.key === 'Enter' && changeView('timeGridWeek')}
            role="menuitem"
        >
            Week
        </button>
        <button 
            type="button"
            class="block w-full text-left px-4 py-2 hover:bg-gray-100 {currentView === 'dayGridMonth' ? 'bg-blue-50 text-blue-600' : ''}"
            on:click={() => changeView('dayGridMonth')}
            on:keydown={e => e.key === 'Enter' && changeView('dayGridMonth')}
            role="menuitem"
        >
            Month
        </button>
        <button 
            type="button"
            class="block w-full text-left px-4 py-2 hover:bg-gray-100 {currentView === 'listWeek' ? 'bg-blue-50 text-blue-600' : ''}"
            on:click={() => changeView('listWeek')}
            on:keydown={e => e.key === 'Enter' && changeView('listWeek')}
            role="menuitem"
        >
            List
        </button>
    </div>
    {/if}
    <EventDetailModal
        bind:isOpen={isModalOpen}
        event={selectedEvent}
        onClose={closeModal}
        onUpdate={refreshEvents}
        onDelete={refreshEvents}
        transition={fade}
    />
    <style>
        .calendar-dropdown {
            z-index: 9999; 
            position: absolute;
        }
        .ec-header-toolbar {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem; /* space between start, center, end */
        }
        .ec-center {
            padding-right: 1rem; 
            padding-left: 1rem;
        }
        .ec-end {
            flex: 0 0 auto;
        }
        .ec-custom-button {
            position: relative;
            padding-right: 1.5rem;
        }
        .ec-custom-button::after {
            content: '';
            position: absolute;
            right: 0.75rem;
            top: 50%;
            transform: translateY(-50%);
            width: 0.75rem;
            height: 0.75rem;
            background-image: url('data:image/svg+xml,<svg fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>');
            background-repeat: no-repeat;
            background-size: contain;
            pointer-events: none;
        }
    </style>
</div>
