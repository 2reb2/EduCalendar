<script>
    import '/src/app.css';
    import { eventsStore } from '$lib/stores/events';
    import courses from '$lib/stores/courses';
    import { fade } from 'svelte/transition';
    import { Button } from 'flowbite-svelte';
    import CourseDetailModal from './CourseDetailModal.svelte'; // Import the course modal

    import { activeModal } from '$lib/stores/modal';
    import { get } from 'svelte/store';
    export let isOpen = false;
    $: {
        if (isOpen && get(activeModal) !== 'eventDetail') {
            activeModal.set('eventDetail');
        } else if (!isOpen && get(activeModal) === 'eventDetail') {
            activeModal.set(null);
        }
    }

    export let event = null;
    export let onClose = () => {};
    export let onUpdate = () => {}; 
    export let onDelete = () => {};

    function handleClose() {
        isEditing = false;
        activeModal.set(null);
        onClose(); // Call parent-provided close handler
    }
    
    let modalRef;
    let isEditing = false;
    let editedEvent = {};
    let showCourseModal = false;
    let selectedCourse = null;
    
    const types = ['Assignment', 'Test', 'Other'];

    const recurrenceOptions = [
        { label: 'None', value: '' },
        { label: 'Daily', value: 'daily' },
        { label: 'Weekdays (Mon-Fri)', value: 'weekday' },
        { label: 'Weekends (Sat-Sun)', value: 'weekend' },
        { label: 'Monday', value: 'monday' },
        { label: 'Tuesday', value: 'tuesday' },
        { label: 'Wednesday', value: 'wednesday' },
        { label: 'Thursday', value: 'thursday' },
        { label: 'Friday', value: 'friday' },
        { label: 'Saturday', value: 'saturday' },
        { label: 'Sunday', value: 'sunday' }
    ];

    // Initialize editedEvent when event changes
    $: if (event) {
        editedEvent = {
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
            type: event.type || 'assignment',
            courseTitle: event.courseTitle || '',
            courseId: event.courseId || '',
            isRecurring: event.isRecurring || false,
            recurrencePattern: event.recurrencePattern || ''
        };
    }

    function openCourseModal() {
        if (event?.isClass && event?.courseId) {
            // Find the course in the courses store
            selectedCourse = $courses.find(c => c.id === event.courseId);
            if (selectedCourse) {
                showCourseModal = true;
                // onClose(); // Close the event modal
                handleClose();
            }
        }
    }

    function closeCourseModal() {
        showCourseModal = false;
        selectedCourse = null;
    }

    async function handleUpdate() {
        try {
            // Find the course object to get the ID and color
            const courseObj = $courses.find(c => c.title === editedEvent.courseTitle);
            
            const updatedData = {
                ...editedEvent,
                courseId: courseObj?.id || '',
                color: courseObj?.color || '#3b82f6'
            };
            
            // Update in events store
            const updatedEvent = await eventsStore.updateEvent(event.id, updatedData);

            // Update local event reference
            event = { ...event, ...updatedEvent };
            
            isEditing = false;
        } catch (error) {
            // console.error('Error updating event:', error);
        }
    }

    async function handleDelete() {
        try {
            await eventsStore.deleteEvent(event.id);
            // onClose();
            handleClose();
        } catch (error) {
            // console.error('Error deleting event:', error);
        }
    }

    function formatTime(timeStr) {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const hour = parseInt(hours);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    }
</script>

{#if isOpen}
<div
    class="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[9991]"
    on:click|self={handleClose}
    on:keydown={(e) => {
        const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        
        if (e.key === 'Escape') {
            // onClose();
            handleClose();
        } else if ((e.key === 'Enter' || e.key === ' ') && !isTextInput) {
            e.preventDefault();
            // onClose();
            handleClose();
        }
    }}
    role="button"
    tabindex="0"
    aria-label="Close modal"
    transition:fade
>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto relative custom-scrollbar">
        <!-- Close Button (X icon) -->
        <button
            class="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            on:click={handleClose}
            aria-label="Close modal"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        {#if event}
            <div class="p-6">
                {#if !isEditing}
                    <h3 class="text-xl text-gray-700 font-semibold mb-4">{event.title}</h3>
                    
                    <div class="space-y-3 mb-6">
                        <div>
                            <span class="font-medium">Date:</span> 
                            {event.allDay 
                                ? `${new Date(event.startDate).toLocaleDateString()}${event.endDate && event.endDate !== event.startDate ? ' - ' + new Date(event.endDate).toLocaleDateString() : ''}`
                                : `${new Date(event.startDate).toLocaleDateString()}${event.endDate && event.endDate !== event.startDate ? ' - ' + new Date(event.endDate).toLocaleDateString() : ''}, ${formatTime(event.startTime)} - ${formatTime(event.endTime)}`
                            }
                        </div>

                        {#if event.isRecurring == true}
                            <div><span class="font-medium">Frequency:</span> every {event.recurrencePattern}</div>
                        {/if}
                        
                        {#if event.courseTitle}
                            <div><span class="font-medium">Course:</span> {event.courseTitle}</div>
                        {/if}

                        {#if event.type}
                            <div><span class="font-medium">Type:</span> {event.type}</div>
                        {/if}

                        {#if event.location}
                            <div><span class="font-medium">Location:</span> {event.location}</div>
                        {/if}
                    </div>
                    
                    <div class="flex justify-end space-x-2">
                        {#if event.isClass}
                            <Button color="alternative" on:click={openCourseModal}>
                                Edit Course Schedule
                            </Button>
                        {:else}
                            <Button color="alternative" on:click={() => isEditing = true}>
                                Edit
                            </Button>
                        {/if}
                        <Button color="red" on:click={handleDelete}>Delete</Button>
                    </div>
                {:else}
                    <h3 class="text-xl font-semibold mb-4">Edit Event</h3>
                    
                    <form class="space-y-4">
                        <div>
                            <label for="title" class="block mb-1 font-medium">Title</label>
                            <input 
                            id="title" 
                            type="text" 
                            class="w-full p-2 border rounded" 
                            bind:value={editedEvent.title}
                            />
                        </div>

                        <div>
                            <label for="courseSelect" class="block mb-1 font-medium">Course</label>
                            <select
                              id="courseSelect"
                              class="w-full p-2 border rounded"
                              bind:value={editedEvent.courseTitle}
                            >
                              <option value="" disabled>Select a course</option>
                              {#each $courses as course}
                                <option value={course.title}>{course.title}</option>
                              {/each}
                            </select>
                        </div>

                        <div>
                            <label for="typeSelect" class="block mb-1 font-medium">Type</label>
                            <select
                              id="typeSelect"
                              class="w-full p-2 border rounded"
                              bind:value={editedEvent.type}
                            >
                              <option value="" disabled>Select type</option>
                              {#each types as type}
                                <option value={type}>{type}</option>
                              {/each}
                            </select>
                        </div>                          
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                            <label for="startDate" class="block mb-1 font-medium">Start Date</label>
                            <input 
                                id="startDate" 
                                type="date" 
                                class="w-full p-2 border rounded" 
                                bind:value={editedEvent.startDate}
                            />
                            </div>
                            
                            {#if !editedEvent.allDay}
                            <div>
                                <label for="startTime" class="block mb-1 font-medium">Start Time</label>
                                <input 
                                id="startTime" 
                                type="time" 
                                class="w-full p-2 border rounded" 
                                bind:value={editedEvent.startTime}
                                />
                            </div>
                            {/if}
                        </div>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                            <label for="endDate" class="block mb-1 font-medium">End Date</label>
                            <input 
                                id="endDate" 
                                type="date" 
                                class="w-full p-2 border rounded" 
                                bind:value={editedEvent.endDate}
                            />
                            </div>
                            
                            {#if !editedEvent.allDay}
                            <div>
                                <label for="endTime" class="block mb-1 font-medium">End Time</label>
                                <input 
                                id="endTime" 
                                type="time" 
                                class="w-full p-2 border rounded" 
                                bind:value={editedEvent.endTime}
                                />
                            </div>
                            {/if}
                        </div>
                        
                        <div class="flex items-center">
                            <input 
                            id="allDay" 
                            type="checkbox" 
                            class="mr-2" 
                            bind:checked={editedEvent.allDay}
                            />
                            <label for="allDay">All Day Event</label>
                        </div>
                        
                        <div>
                            <label for="location" class="block mb-1 font-medium">Location</label>
                            <input 
                            id="location" 
                            type="text" 
                            class="w-full p-2 border rounded" 
                            bind:value={editedEvent.location}
                            />
                        </div>
            
                        <div class="flex items-center gap-3">
                            <label for="recurrenceToggle" class="w-32 font-semibold">Recurring Event</label>
                            <input 
                                id="recurrenceToggle" 
                                type="checkbox" 
                                bind:checked={editedEvent.isRecurring}
                                class="w-4 h-4"
                            />
                          </div>
                          {#if editedEvent.isRecurring}
                          <div class="flex items-center gap-3">
                              <label for="recurrencePattern" class="w-32 font-semibold">Recurrence Pattern</label>
                              <select 
                                  id="recurrencePattern" 
                                  bind:value={editedEvent.recurrencePattern}
                                  class="flex-1 p-2 border rounded"
                              >
                                  {#each recurrenceOptions as option}
                                      <option value={option.value}>{option.label}</option>
                                  {/each}
                              </select>
                          </div>
                          {/if}
                        
                        <div class="flex justify-end space-x-2">
                            <Button 
                                color="alternative" 
                                on:click={() => isEditing = false}
                            >
                                Cancel
                            </Button>
                            <Button 
                                color="blue" 
                                on:click={handleUpdate}
                            >
                                Save Changes
                            </Button>
                        </div>
                    </form>
                {/if}
            </div>
        {/if}
    </div>
</div>
{/if}

{#if showCourseModal && selectedCourse}
    <CourseDetailModal
        bind:isOpen={showCourseModal}
        course={selectedCourse}
        onClose={closeCourseModal}
        onUpdate={() => {
            closeCourseModal();
            onUpdate();
            // You might want to refresh events here if needed
        }}
        onDelete={() => {
            closeCourseModal();
            onDelete();
            // You might want to refresh events here if needed
        }}
    />
{/if}