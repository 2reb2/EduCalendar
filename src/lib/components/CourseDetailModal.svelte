<script>
    import { db } from '$lib/firebase';
    import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
    import { collection, query, where, getDocs, writeBatch } from 'firebase/firestore';
    import { Button } from 'flowbite-svelte';
    import { fade } from 'svelte/transition';

    export let course = null;
    export let isOpen = false;
    export let onClose = () => {};
    export let onUpdate = () => {};
    export let onDelete = () => {};

    let editedCourse = {};

    $: if (course) {
        editedCourse = {
            title: course.title,
            instructor: course.instructor || '',
            description: course.description || '',
            color: course.color || '#3b82f6',
            schedule: [
            {
                day: course.schedule?.[0]?.day || '',
                start: course.schedule?.[0]?.start || '',
                end: course.schedule?.[0]?.end || '',
                location: course.schedule?.[0]?.location || ''
            },
            {
                day: course.schedule?.[1]?.day || '',
                start: course.schedule?.[1]?.start || '',
                end: course.schedule?.[1]?.end || '',
                location: course.schedule?.[1]?.location || ''
            }
            ]
        };
    }

    async function handleUpdate() {
      try {
        const batch = writeBatch(db);
        
        // 1. Update the course document
        const courseRef = doc(db, 'courses', course.id);
        batch.update(courseRef, {
          title: editedCourse.title,
          color: editedCourse.color,
          instructor: editedCourse.instructor,
          description: editedCourse.description,
          schedule: editedCourse.schedule.filter(slot => 
            slot.day && (slot.start || slot.end || slot.location)
          ),
          updatedAt: new Date().toISOString()
        });

        // 2. Find and update all events for this course
        const eventsQuery = query(collection(db, 'events'), where('courseId', '==', course.id));
        const eventsSnapshot = await getDocs(eventsQuery);
        
        eventsSnapshot.forEach(eventDoc => {
          const eventRef = doc(db, 'events', eventDoc.id);
          batch.update(eventRef, {
            courseTitle: editedCourse.title,
            color: editedCourse.color
          });
        });

        // Commit all changes as a single batch
        await batch.commit();
        
        // Notify parent and close modal
        onUpdate();
        onClose();
      } catch (error) {
        // console.error('Error updating course and events:', error);
      }
    }

    async function handleDelete() {
        const ref = doc(db, 'courses', course.id);
        await deleteDoc(ref);
        onDelete();
        onClose();
    }

    let selectedCourseColor = '';
    const courseColors = [
        { name: 'Red', value: '#EF4444' },
        { name: 'Amber', value: '#F59E0B' },
        { name: 'Emerald', value: '#10B981' },
        { name: 'Blue', value: '#3B82F6' },
        { name: 'Indigo', value: '#6366F1' },
        { name: 'Violet', value: '#8B5CF6' },
        { name: 'Pink', value: '#EC4899' },
        { name: 'Gray', value: '#6B7280' }
    ];
    const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
</script>
  
{#if isOpen}
<div
    class="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[9991]"
    on:click|self={onClose}
    on:keydown={(e) => {
        // Only handle keys if not in an input/textarea/select
        const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        
        if (e.key === 'Escape') {
        onClose();
        } else if ((e.key === 'Enter' || e.key === ' ') && !isTextInput) {
        e.preventDefault(); // Prevent space from scrolling the page
        onClose();
        }
    }}
    role="button"
    tabindex="0"
    aria-label="Close modal"
    transition:fade
>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative p-6 custom-scrollbar">
    <button
        class="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
        on:click={onClose}
        aria-label="Close modal"
    >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
    </button>

    <h3 class="text-xl font-semibold mb-4">Edit Course</h3>

    <div class="space-y-4">
        <!-- Course Name + Dropdown Color Picker -->
        <div class="flex flex-col md:flex-row gap-4 items-center">
          <!-- Course Name -->
          <div class="flex-1 flex items-center gap-3 w-full">
            <label for="courseName" class="w-20 font-semibold">Course Name <span class="text-red-500">*</span></label>
            <input
              id="courseName"
              type="text"
              bind:value={editedCourse.title}
              class="flex-1 p-2 border rounded"
            />
          </div>

          <!-- Dropdown Color Selector -->
          <div class="flex items-center gap-2 w-full md:w-auto">
            <label for="colorSelect" class="font-semibold">Color <span class="text-red-500">*</span></label>
            <!-- Select dropdown -->
            <select
              id="colorSelect"
              bind:value={editedCourse.color}
              class="p-2 border rounded"
              style="min-width: 10rem"
            >
              <option value="" disabled selected>Select color</option>
              {#each courseColors as color}
                <option value={color.value} style="color: {color.value};">
                  {color.name}
                </option>
              {/each}
            </select>
          </div>
        </div>

        <!-- Instructor Name -->
        <div class="flex items-center gap-3">
          <label for="instructorName" class="w-20 font-semibold">Instructor</label>
          <input id="instructorName" type="text" bind:value={editedCourse.instructor} class="flex-1 p-2 border rounded" />
        </div>

        <!-- Class Slots Side-by-Side -->
        <div class="flex flex-col md:flex-row gap-4">
          <!-- Class Slot 1 -->
          <div class="flex-1 space-y-2">
            <p class="font-semibold">Class Slot 1</p>
            
            <!-- Day of the Week -->
            <div class="flex items-center gap-3">
              <label for="slot1Day" class="w-20 font-semibold">Day</label>
              <select id="slot1Day" bind:value={editedCourse.schedule[0].day} class="w-[12rem] p-2 border rounded">
                <option value="" disabled selected>Select day</option>
                {#each daysOfWeek as day}
                  <option value={day}>{day}</option>
                {/each}
              </select>
            </div>

            <!-- Time Start -->
            <div class="flex items-center gap-3">
              <label for="slot1Start" class="w-20 font-semibold">Start</label>
              <input id="slot1Start" type="time" bind:value={editedCourse.schedule[0].start} class="w-[12rem] p-2 border rounded"/>
            </div>

            <!-- Time End -->
            <div class="flex items-center gap-3">
              <label for="slot1End" class="w-20 font-semibold">End</label>
              <input id="slot1End" type="time" bind:value={editedCourse.schedule[0].end} class="w-[12rem] p-2 border rounded" />
            </div>

            <!-- Location -->
            <div class="flex items-center gap-3">
              <label for="slot1Location" class="w-20 font-semibold">Location</label>
              <input id="slot1Location" type="text" bind:value={editedCourse.schedule[0].location} class="w-[12rem] p-2 border rounded" />
            </div>
          </div>

          <!-- Class Slot 2 -->
          <div class="flex-1 space-y-2">
            <p class="font-semibold">Class Slot 2</p>

            <!-- Day of the Week -->
            <div class="flex items-center gap-3">
              <label for="slot2Day" class="w-20 font-semibold">Day</label>
              <select id="slot2Day" bind:value={editedCourse.schedule[1].day} class="w-[12rem] p-2 border rounded">
                <option value="" disabled selected>Select day</option>
                {#each daysOfWeek as day}
                  <option value={day}>{day}</option>
                {/each}
              </select>
            </div>

            <!-- Time Start -->
            <div class="flex items-center gap-3">
              <label for="slot2Start" class="w-20 font-semibold">Start</label>
              <input id="slot2Start" type="time" bind:value={editedCourse.schedule[1].start} class="w-[12rem] p-2 border rounded" />
            </div>

            <!-- Time End -->
            <div class="flex items-center gap-3">
              <label for="slot2End" class="w-20 font-semibold">End</label>
              <input id="slot2End" type="time" bind:value={editedCourse.schedule[1].end} class="w-[12rem] p-2 border rounded" />
            </div>

            <!-- Location -->
            <div class="flex items-center gap-3">
              <label for="slot2Location" class="w-20 font-semibold">Location</label>
              <input id="slot2Location" type="text" bind:value={editedCourse.schedule[1].location} class="w-[12rem] p-2 border rounded" />
            </div>
          </div>
        </div>

        <!-- Description -->
        <div class="flex items-start gap-3">
          <label for="courseDescription" class="w-20 font-semibold pt-2">Description</label>
          <textarea id="courseDescription" bind:value={editedCourse.description} rows="3" class="flex-1 p-2 border rounded"></textarea>
        </div>

        <div class="flex justify-end space-x-2">
            <Button color="red" on:click={handleDelete}>Delete</Button>
            <Button color="blue" on:click={handleUpdate}>Save Changes</Button>
        </div>
    </div>
    </div>
</div>
{/if}
  