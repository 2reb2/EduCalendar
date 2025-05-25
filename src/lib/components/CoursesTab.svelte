<script>
    import { onMount, onDestroy } from 'svelte';
    import { collection, query, where, getDocs } from 'firebase/firestore';
    import { db, auth } from '$lib/firebase';
    import coursesStore from '$lib/stores/courses';
    import { eventsStore } from '$lib/stores/events';

    import { PenSolid, AngleDownOutline, AngleUpOutline } from 'flowbite-svelte-icons';

    let openDetails = {};
    let openTasks = {};
    let events = [];

    // Subscribe to stores
    let unsubscribeCourses;
    let unsubscribeEvents;

    onMount(() => {
        // Load initial data
        coursesStore.load();

        // Subscribe to courses store
        unsubscribeCourses = coursesStore.subscribe($courses => {
            courses = $courses;
            
            // Initialize open states for new courses
            const newOpenDetails = {...openDetails};
            const newOpenTasks = {...openTasks};
            
            $courses.forEach(course => {
                if (!(course.id in newOpenDetails)) {
                    newOpenDetails[course.id] = true; // Default to open
                }
                if (!(course.id in newOpenTasks)) {
                    newOpenTasks[course.id] = true; // Default to open
                }
            });

            openDetails = newOpenDetails;
            openTasks = newOpenTasks;
        });

        // Subscribe to events store
        unsubscribeEvents = eventsStore.subscribe($events => {
            events = $events;
        });
    });

    onDestroy(() => {
        unsubscribeCourses();
        if (unsubscribeEvents) unsubscribeEvents();
    });

    // Toggle functions
    function toggle(section, id) {
        if (section === 'details') {
            openDetails[id] = !openDetails[id];
            openDetails = openDetails; // Trigger reactivity
        } else if (section === 'tasks') {
            openTasks[id] = !openTasks[id];
            openTasks = openTasks; // Trigger reactivity
        }
    }

    // Refresh function that can be called from parent
    export function refresh() {
        coursesStore.load();
    }

    // Initialize with store subscription
    let courses = [];
    const unsubscribe = coursesStore.subscribe(value => {
      courses = value;

      // Reconstruct to ensure reactivity
      let newOpenDetails = { ...openDetails };
      let newOpenTasks = { ...openTasks };

      for (const course of courses) {
        newOpenDetails[course.id] = openDetails[course.id] ?? true; // Default to open
        newOpenTasks[course.id] = openTasks[course.id] ?? true; // Default to open
      }

      openDetails = newOpenDetails;
      openTasks = newOpenTasks;
    });

    // event detail modal start
    import EventDetailModal from './EventDetailModal.svelte';

    let selectedEvent = null;
    let showEventModal = false;

    function handleEventClick(event) {
      selectedEvent = {
        ...event,
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
        type: event.type || 'Assignment'
      };
      showEventModal = true;
    }
    // event detail modal end

    // course detail modal start
    import CourseDetailModal from './CourseDetailModal.svelte';

    let selectedCourse = null;
    let showCourseModal = false;

    function handleEditCourse(course) {
      selectedCourse = course;
      showCourseModal = true;
    }

    $: {
      // When events change, update the courses with their corresponding events
      if (courses && events) {
        courses = courses.map(course => {
          const courseEvents = events.filter(
            event => event.courseId === course.id && !event.isClass
          );
          return {
            ...course,
            events: courseEvents
          };
        });
      }
    }
    //course detail modal end

    // async function fetchEventsForCourse(courseId) {
    //   const eventsQuery = query(
    //     collection(db, 'events'),
    //     where('courseId', '==', courseId)
    //   );
    //   const eventsSnapshot = await getDocs(eventsQuery);
    //   return eventsSnapshot.docs.map(eventDoc => ({
    //     id: eventDoc.id,
    //     ...eventDoc.data()
    //   }));
    // }

    // async function fetchCourses() {
    //   if (!auth.currentUser) return;

    //   const q = query(collection(db, 'courses'), where('userId', '==', auth.currentUser.uid));
    //   const querySnapshot = await getDocs(q);

    //   const coursesData = await Promise.all(querySnapshot.docs.map(async (doc) => {
    //     const course = { id: doc.id, ...doc.data()};
        
    //     // Fetch events for this course
    //     const events = await fetchEventsForCourse(doc.id);
    //     return {
    //       ...course,
    //       events: events
    //     };
    //   }));

    //   // Update the store which will automatically update our 'courses' variable
    //   coursesStore.set(coursesData);

    //   openDetails = Object.fromEntries(courses.map(c => [c.id, true]));
    //   openTasks = Object.fromEntries(courses.map(c => [c.id, true]));
    // }

    // // Called when this tab is shown or reloaded
    // onMount(() => {
    //   coursesStore.load();
    //   return () => unsubscribe();
    // });

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

    // @ts-ignore
    // function toggle(section, id) {
    //     if (section === 'details') {
    //         // @ts-ignore
    //         openDetails[id] = !openDetails[id];
    //     } else if (section === 'tasks') {
    //         // @ts-ignore
    //         openTasks[id] = !openTasks[id];
    //     }
    // }
</script>
 
<!-- Scrollable course cards -->
<div class="overflow-x-auto custom-scrollbar scroll-smooth py-2">
  <div class="flex gap-2 sm:gap-4 min-w-max">
    {#each courses as course}
      <div class="w-[300px] bg-white shadow rounded-lg p-4 flex-shrink-0 border border-gray-200 grid" style="grid-template-rows: auto auto minmax(0, 1fr); height: fit-content; max-height: 80vh;">
        <h2 class="text-lg text-white font-semibold mb-3 text-center w-full" style="background-color: {course.color};">{course.title}</h2>

        <!-- Details Section -->
        <div class="mb-4 space-y-3 text-sm">
          <button
            class="w-full text-center font-medium text-sm hover:underline mb-2 flex flex-row justify-between items-center gap-1 border-b border-gray-300"
            on:click={() => toggle('details', course.id)}
          >
            <span>Details</span>
            {#if openDetails[course.id]}
                <AngleDownOutline class="w-4 h-4" />
            {:else}
                <AngleUpOutline class="w-4 h-4" />
            {/if}
          </button>
          {#if openDetails[course.id]}
            <div class="space-y-3 text-sm">
              <!-- Instructor -->
              <div class="flex justify-between items-center">
                <span class="text-gray-500">
                    <span class="font-medium">Instructor:</span> {course.instructor}
                </span>
                <button on:click={() => handleEditCourse(course)}>
                    <PenSolid class="w-4 h-4 text-gray-500 hover:text-blue-500"></PenSolid>
                </button>
              </div>
  
              <!-- Class Time -->
              <div>
                <span class="font-medium">Class Time:</span>
                <div class="mt-1 space-y-1">
                  {#if !course.schedule || course.schedule.length === 0 || course.schedule.every(s => !s.day && !s.start && !s.end && !s.location)}
                    <p class="text-sm text-gray-500 italic">No class time added.</p>
                  {:else}
                    {#each course.schedule as t}
                      <div class="bg-gray-100 rounded px-3 py-1 text-xs">
                        <div>{t.day}</div>
                        <div class="text-gray-600">{t.start} - {t.end} @ {t.location}</div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>
  
              <!-- Description -->
              <div>
                <span class="font-medium">Description:</span>
                <div>{course.description}</div>
              </div>
            </div>
          {/if}
        </div>

        <!-- Tasks Section -->
        <div class="min-h-0 flex flex-col">
          <button 
            class="w-full text-center font-medium text-sm hover:underline mb-2 flex flex-row justify-between items-center gap-1 border-b border-gray-300"
            on:click={() => toggle('tasks', course.id)}
          >
            <span>Tasks</span>
            {#if openTasks[course.id]}
              <AngleDownOutline class="w-4 h-4" />
            {:else}
              <AngleUpOutline class="w-4 h-4" />
            {/if}
          </button>
          
          {#if openTasks[course.id]}
            <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2">
              {#each course.events as event}
                <div 
                  class="flex border rounded bg-white shadow p-1 pl-3 relative cursor-pointer hover:shadow-md transition-shadow"
                  on:click={() => handleEventClick(event)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => e.key === 'Enter' || e.key === ' ' ? handleEventClick(event) : null}
                >
                  <div class="absolute left-0 top-0 h-full w-2 rounded-l" style="background-color: {event.color}"></div>
                  <div class="pl-2 text-sm text-gray-800 w-full">
                    <div class="font-semibold">{event.title}</div>
                    <div class="text-gray-500 text-xs">
                      {formatEventDatetime(event.startDate, event.startTime, event.endDate, event.endTime, event.allDay, event.isRecurring, event.recurrencePattern)}
                    </div>
                    <div class="text-gray-400 text-xs">{event.location}</div>
                  </div>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/each}
  </div>
  <EventDetailModal 
    bind:isOpen={showEventModal}
    event={selectedEvent} 
    onClose={() => showEventModal = false}
    onUpdate={refresh}
    onDelete={refresh}
  />
  <CourseDetailModal
    bind:isOpen={showCourseModal}
    course={selectedCourse}
    onClose={() => showCourseModal = false}
    onUpdate={refresh}
    onDelete={refresh}
  />
</div>
  