<script>
  import { onMount, onDestroy } from 'svelte';
  import { collection, query, where, orderBy, onSnapshot, getDocs } from 'firebase/firestore';
  import { db, auth } from '$lib/firebase';
  import { onAuthStateChanged } from 'firebase/auth';
  import { draggableScroll } from '$lib/actions/draggableScroll.js';
  import { eventsStore } from '$lib/stores/events.js';

  // event detail modal start
  import EventDetailModal from './EventDetailModal.svelte';
  let selectedEvent = null;
  let showEventModal = false;
  
  function handleEventClick(event) {
    selectedEvent = event;
    // console.log('Raw event data:', event);
    selectedEvent = {
      ...event,
      // Ensure all required fields are present
      id: event.id,
      title: event.title,
      description: event.description || '',
      location: event.location || '',
      startDate: event.startDate,
      endDate: event.endDate || event.startDate,
      startTime: event.startTime || '',
      endTime: event.endTime || '',
      allDay: event.allDay || false,
      color: event.color || '#3b82f6',
      type: event.type || ''
    };
    showEventModal = true;
    // console.log('Modal should be open. showEventModal:', showEventModal);
  }
  
  // Refresh events after updates
  async function refreshEvents() {
    if (!auth.currentUser) return;
    
    const q = query(
      collection(db, 'events'),
      where('userId', '==', auth.currentUser.uid),
      sortBy === 'date' ? orderBy('startDate') : orderBy('courseTitle')
    );
    
    const snapshot = await getDocs(q);
    const updatedEvents = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    events = filterEventsByRange(updatedEvents, filterRange);
    eventsStore.set(events);
  }
  // event detail modal end

  let sortBy = 'date';
  let filterRange = 'all';
  let filterType = 'all';
  let events = [];
  let unsubscribeFirestore;

  const sortOptions = ['date', 'course'];
  const filterOptions = ['all', 'week', 'month'];

  const timeFilterOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'today', label: 'Today' }
  ];

  const typeFilterOptions = [
    { value: 'all', label: 'All Types' },
    // { value: 'Class', label: 'Classes' },
    { value: 'Assignment', label: 'Assignments' },
    { value: 'Test', label: 'Tests' },
    { value: 'Other', label: 'Others' }
  ];
  
  import { derived } from 'svelte/store';
  import { get } from 'svelte/store';
  
  let filteredEvents = [];

  $: {
    // Filter non-class events from local events
    const nonClassEvents = events.filter(event => !event.isClass);
    
    // Apply filters and sorting
    filteredEvents = [...filterEventsByRange(nonClassEvents, filterRange, filterType)];

    // Apply sorting
    filteredEvents = sortBy === 'date'
      ? filteredEvents.sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
      : filteredEvents.sort((a, b) => (a.courseTitle || '').localeCompare(b.courseTitle || ''));
    
    // console.log('Filtered events:', filteredEvents.length);
  }

  // Function to filter events based on date range
  function filterEventsByRange(events, timeRange, typeFilter) {
    let filtered = [...events];

    // Always preserve class events
    const classEvents = filtered.filter(event => event.isClass);
    
    // Filter non-class events by time range
    if (timeRange !== 'all') {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      let rangeStart = new Date(now);
      let rangeEnd = new Date(now);

      if (timeRange === 'today') {
        rangeEnd.setHours(23, 59, 59, 999);
      } else if (timeRange === 'week') {
        // Modified week calculation to match calendar's firstDay:1 (Monday)
        const day = now.getDay(); // 0=Sunday, 1=Monday,...
        
        // If Sunday (0), show previous Monday to Sunday
        if (day === 0) {
          rangeStart.setDate(now.getDate() - 6); // Previous Monday
        } 
        // Otherwise show current Monday to Sunday
        else {
          rangeStart.setDate(now.getDate() - (day - 1)); // Current week's Monday
        }
        
        rangeEnd.setDate(rangeStart.getDate() + 6); // Following Sunday
        rangeEnd.setHours(23, 59, 59, 999);
      } else if (timeRange === 'month') {
        rangeStart = new Date(now.getFullYear(), now.getMonth(), 1);
        rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        rangeEnd.setHours(23, 59, 59, 999);
      }

      filtered = filtered.filter(event => {
        if (event.isClass) return true; // Keep all class events
        
        if (!event.startDate) return false;

        const eventStart = new Date(event.startDate);
        // const eventEnd = event.endDate ? new Date(event.endDate) : new Date(event.startDate);
        const eventEnd = event.endDate && event.endDate.trim() !== ""
          ? new Date(event.endDate)
          : new Date(event.startDate);

        eventStart.setHours(0, 0, 0, 0);
        eventEnd.setHours(23, 59, 59, 999);

        return eventStart <= rangeEnd && eventEnd >= rangeStart;
      });
    }

    // Filter by type (still exclude from class events)
    if (typeFilter !== 'all') {
      filtered = filtered.filter(event => 
        event.isClass || event.type === typeFilter
      );
    }

    return filtered;
  }


  // Set up Firestore listener
  function setupListener() {
    if (!auth.currentUser) return;
    
    if (unsubscribeFirestore) unsubscribeFirestore();
    
    const q = query(
      collection(db, 'events'),
      where('userId', '==', auth.currentUser.uid),
      orderBy('startDate')
    );
    
    unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      events = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    });
  }

  onMount(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Initialize from eventsStore if available
        const initialEvents = get(eventsStore);
        if (initialEvents?.length > 0) {
          events = initialEvents.filter(event => !event.isClass); // Only take non-class events
        }
        setupListener();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeFirestore) unsubscribeFirestore();
    };
  });

  onDestroy(() => {
    if (unsubscribeFirestore) unsubscribeFirestore();
  });

  // React to sort/filter changes - more precise reactivity
  // $: sortBy, filterRange, filterType, setupListener();
  $: if (auth.currentUser) {
    setupListener();
  }

  function formatEventDatetime(startDate, startTime, endDate, endTime, allDay = false, isRecurring = false, recurrencePattern) {
    const optsDate = { day: 'numeric', month: 'short' };

    // Handle invalid dates first
    if ((!startDate) && (isRecurring)) return 'Every ' + recurrencePattern;
    if (!startDate) return 'Invalid Date';

    try {
        const start = new Date(startDate);
        if (isNaN(start.getTime())) return 'Invalid Date';

        let formattedString = '';

        if (isRecurring) {
            formattedString += '🔁 '; // Recurring icon
        }

        if (allDay || !startTime || !endTime) {
            const formattedStartDate = start.toLocaleDateString('en-MY', optsDate);

            if (endDate && endDate !== startDate) {
                const end = new Date(endDate);
                const formattedEndDate = end.toLocaleDateString('en-MY', optsDate);
                formattedString += `${formattedStartDate} to ${formattedEndDate} • All Day`;
            } else {
                formattedString += `${formattedStartDate} • All Day`;
            }
        } else {
            const startTimeStr = startTime.includes(':') ? startTime : `${startTime}:00`;
            const endTimeStr = endTime.includes(':') ? endTime : `${endTime}:00`;
            
            const startTimeObj = new Date(`${startDate}T${startTimeStr}`);
            const endTimeObj = new Date(`${endDate || startDate}T${endTimeStr}`);

            if (isNaN(startTimeObj.getTime())) {
                return `${formattedString}Invalid Time`;
            }

            const formattedStartDate = start.toLocaleDateString('en-MY', optsDate);
            const formattedEndDate = endDate ? new Date(endDate).toLocaleDateString('en-MY', optsDate) : formattedStartDate;

            function formatTime(date) {
                const h = date.getHours();
                const m = date.getMinutes().toString().padStart(2, '0');
                const hour12 = h % 12 === 0 ? 12 : h % 12;
                const ampm = h < 12 ? 'am' : 'pm';
                return `${hour12}:${m}${ampm}`;
            }

            const startFormatted = formatTime(startTimeObj);
            const endFormatted = formatTime(endTimeObj);

            if (startDate === endDate || !endDate) {
                formattedString += `${formattedStartDate} • ${startFormatted} - ${endFormatted}`;
            } else {
                formattedString += `${formattedStartDate} to ${formattedEndDate} • ${startFormatted} - ${endFormatted}`;
            }
        }

        return formattedString;
    } catch (error) {
        // console.error('Error formatting date:', error);
        return 'Invalid Date';
    }
  }
</script>

<!-- Rest of your HTML remains the same -->

<div class="flex flex-col h-full gap-2">
    <!-- Section 1: Sort & Filter -->
    <div class="flex flex-col gap-1">
        <!-- Sort -->
        <div>
            <span class="font-semibold mr-2">Sort by:</span>
            <div class="inline-flex overflow-x-auto whitespace-nowrap gap-1">
            {#each sortOptions as option}
                <button
                class="px-3 py-1 rounded text-sm transition-colors whitespace-nowrap
                        {sortBy === option 
                        ? 'bg-blue-500 text-white font-semibold' 
                        : 'bg-white text-gray-700 hover:bg-gray-100'}"
                on:click={() => sortBy = option}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
                </button>
            {/each}
            </div>
        </div>

        <!-- Filter -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <!-- Time + type Filter -->
          <div class="flex items-center space-x-2">
              <label for="timeFilter" class="font-semibold shrink-0">Filter:</label>
              <select
                  id="timeFilter"
                  class="flex-1 p-2 border rounded text-sm"
                  bind:value={filterRange}
              >
                  {#each timeFilterOptions as option}
                      <option value={option.value}>{option.label}</option>
                  {/each}
              </select>
              <label for="typeFilter" class="font-semibold shrink-0"></label>
              <select
                  id="typeFilter"
                  class="flex-1 p-2 border rounded text-sm"
                  bind:value={filterType}
              >
                  {#each typeFilterOptions as option}
                      <option value={option.value}>{option.label}</option>
                  {/each}
              </select>
          </div>
          
      </div>
  </div>

    <!-- Section 2: Event Cards -->
    <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar">
      <!-- {#if events.length === 0} -->
      {#if filteredEvents.length === 0}
          <div class="text-center py-8 text-gray-500">
              No events found matching your filters
          </div>
      {:else}
          <div class="flex flex-col space-y-2">
              <!-- {#each events as event} -->
              {#each filteredEvents as event}
              <div 
                class="flex border rounded bg-white shadow p-1 pl-3 relative cursor-pointer hover:shadow-md transition-shadow"
                on:click={() => handleEventClick(event)}
                on:keydown={(e) => {
                  // Handle both Enter and Space key presses
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault(); // Prevent scrolling on Space
                    handleEventClick(event);
                  }
                }}
                role="button"
                tabindex="0"
              >
                  <!-- Left border -->
                  <div class="absolute left-0 top-0 h-full w-2 rounded-l" style="background-color: {event.color || '#3b82f6'}"></div>
          
                  <!-- Content -->
                  <div class="pl-2 text-sm text-gray-800 w-full">
                      <div class="font-semibold">{event.title}</div>
                      <div class="text-gray-500 text-xs">
                          {formatEventDatetime(event.startDate, event.startTime, event.endDate, event.endTime, event.allDay, event.isRecurring, event.recurrencePattern)}
                      </div>
                      <div class="text-gray-400 text-xs">
                          {event.courseTitle} • {event.type}
                          {#if event.location} • {event.location}{/if}
                      </div>
                  </div>
              </div>
              {/each}
          </div>
      {/if}
  </div>
  
  <EventDetailModal 
      bind:isOpen={showEventModal}
      event={selectedEvent} 
      onClose={() => showEventModal = false}
      onUpdate={refreshEvents}
      onDelete={refreshEvents}
  />
</div>

  