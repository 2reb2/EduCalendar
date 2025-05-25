<script>
    import { onMount } from 'svelte';
    import courses from '$lib/stores/courses.js';
    import { eventsStore } from '$lib/stores/events.js';
    import { db, auth } from '$lib/firebase';
    import { doc, updateDoc, getDocs, collection, query, where, orderBy } from 'firebase/firestore';
    import { AngleDownOutline, AngleUpOutline } from 'flowbite-svelte-icons';

    import '/src/app.css';
    import AddEventModal from './AddEventModal.svelte';
    import DonutChart from '$lib/components/DonutChart.svelte';
    import OverviewList from '$lib/components/OverviewList.svelte';
    import { Calendar, TimeGrid, Interaction } from '@event-calendar/core';

    import { fade } from 'svelte/transition';

    import { setActiveModal, clearModal } from '$lib/stores/modal';

    let selectedEvent = null;
    let isModalOpen = false;

    function openModal(event) {
        selectedEvent = event;
        isModalOpen = true;
        setActiveModal('eventDetail');
    }

    function closeModal() {
        isModalOpen = false;
        selectedEvent = null;
        clearModal();
    }

    let showDonut = true; // donut chart visibility

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
                
                // Convert day string to day number (0=Sunday, 1=Monday, etc.)
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
                    startDate: course.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0],
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

    function formatTimeForFirestore(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}:00`; // Format as "HH:MM:00"
    }

    // eventDetailsModal start
    import EventDetailModal from '$lib/components/EventDetailModal.svelte';

    // function openModal(event) {
    //     selectedEvent = event;
    //     isModalOpen = true;
    // }

    // function closeModal() {
    //     isModalOpen = false;
    //     selectedEvent = null;
    // }
    // eventDetailModal end

    let options = {
        height: '100%',
        view: 'timeGridWeek',
        plugins: [Interaction],
        editable: false, //DRAG AND RESIZE DISABLED
        eventStartEditable: false,  //DRAG AND RESIZE DISABLED
        eventDurationEditable: false, //DRAG AND RESIZE DISABLED
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

    onMount(async () => {
        // console.log('[ProfileTab] Component mounted');
        await courses.load(); // Wait for courses to load
        
        return () => {
            // console.log('[ProfileTab] Unmounting, unsubscribing from events');
            unsubscribeEvents();
        };
    });

    // Subscribe to eventsStore to update calendar
    const unsubscribeEvents = eventsStore.subscribe(events => {
        // console.log('[ProfileTab] eventsStore updated. Event count:', events?.length || 0);
        if (!events) {
            // console.log('[ProfileTab] No events in store');
            return;
        }

        const expandedEvents = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Show events for 1 year (adjust as needed)
        const endDate = new Date(today);
        endDate.setFullYear(today.getFullYear() + 1);

        // console.log('[ProfileTab] Processing events for calendar');
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
                // console.log('event.isClass', currentDate);

                // If the start date is in the future, jump to that date
                if (!event.isClass) {
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (currentDate < today) {
                        currentDate = new Date(today);
                    }
                }
                
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

        // console.log("[ProfileTab] Final expanded events count:", expandedEvents.length); //debug
        options.events = expandedEvents;
        if (calendarRef) {
            // console.log('[ProfileTab] Updating calendar with events');
            calendarRef.setOption('events', expandedEvents);
        } else {
            // console.log('[ProfileTab] Calendar ref not available yet');
        }
    });

    // Helper function to check if a date matches the recurrence pattern
    function matchesRecurrencePattern(date, pattern) {
        // Day mapping: Sunday is 0, Monday is 1, and so on...
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
                return day === 0 || day === 6; // Saturday or Sunday
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

    // Helper function to create a calendar event object
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
                title += ` (${event.location})`;
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
                // Parse time (assuming format like "18:00")
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
                
                // If end time is before start time (crossing midnight), add a day
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

    // Helper function to get next day number for recurrence
    function getNextDayNumber(fromDate, pattern) {
        const dayMap = {
            'sunday': 0, 'monday': 1, 'tuesday': 2, 
            'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
        };
        
        const targetDay = dayMap[pattern.toLowerCase()] || 1; // Default to Monday
        const currentDay = fromDate.getDay();
        
        // If today is already the target day, keep it as the next event
        if (currentDay === targetDay) {
            return fromDate;
        }
        
        // Calculate how many days until the next target day
        const daysUntilNext = (targetDay + 7 - currentDay) % 7;
        const nextOccurrence = new Date(fromDate);
        nextOccurrence.setDate(fromDate.getDate() + daysUntilNext);
        
        return nextOccurrence;
    }
</script>

{#if !$eventsStore || !$courses}
    <div class="absolute inset-0 flex items-center justify-center">
        Loading events...
    </div>
{:else}
    <div class="homepage-overview w-full sm:w-[30%] flex flex-col space-y-2 pt-3">
        <!-- Toggle button with fixed right positioning -->
        <div class="relative">
            <button
                class="w-full mb-1 rounded flex justify-between items-center"
                on:click={() => showDonut = !showDonut}
            >
                {#if !showDonut}
                    <span class="flex-1 text-center">Show Donut Chart</span>
                {:else}
                    <span class="flex-1"></span> <!-- Empty spacer -->
                {/if}
                {#if showDonut}
                    <AngleUpOutline class="w-4 h-4" />
                {:else}
                    <AngleDownOutline class="w-4 h-4" />
                {/if}
            </button>
        </div>
        {#if showDonut}
        <div class="homepage-ring h-[30%]">
            <DonutChart />
        </div>
        {/if}
        <div class="hompage-list flex-1 overflow-hidden">
            <OverviewList></OverviewList>
        </div>
    </div>
    <div class="homepage-calendar w-[70%] p-2 flex flex-col hidden sm:flex">
        <Calendar bind:this={calendarRef} plugins={[TimeGrid, Interaction]} {options} class="flex-1"/>
    </div>
    <EventDetailModal 
        bind:isOpen={isModalOpen}
        event={selectedEvent}
        onClose={closeModal}
        onUpdate={refreshEvents}
        onDelete={refreshEvents}
        transition={fade}
    />
    <style>
    :global(.fc .fc-now-indicator) {
        z-index: 1 !important;
    }
    </style>
{/if}