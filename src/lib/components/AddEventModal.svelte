<script>
  import { 
    Button, Modal, Label, Input,
    Helper, Alert, Card, Badge
  } from 'flowbite-svelte';
  import { PlusOutline, PenSolid } from 'flowbite-svelte-icons';
  
  import { onMount } from 'svelte';
  import { collection, addDoc, getDocs, query, where, serverTimestamp } from 'firebase/firestore';
  import { db, auth } from '$lib/firebase';
  import coursesStore from '$lib/stores/courses';

  import CourseDetailModal from './CourseDetailModal.svelte';

  export let isDisabled = false;

  export let onCourseAdded;
  $: loadedCourses = $coursesStore.map(c => c.title);

  async function loadCourses() {
    if (!auth.currentUser) return;
    const q = query(collection(db, 'courses'), where('userId', '==', auth.currentUser.uid));
    const snapshot = await getDocs(q);
    const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    coursesStore.set(list);
  }

  let isOpen = false;
	let description = '';
	let showPreview = false;
  let isEditingPreview = false;

  let selectedCourse = '';
	let selectedType = '';

  let previewTitle = '';
  let previewStartDate = '';
  let previewEndDate = '';
  let previewStartTime = '';
  let previewEndTime = '';
  let previewLocation = '';
  let previewAllDay = true;
  let previewFrequency = '';
  let isRecurring = false;
  let recurrencePattern = '';

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

	// const courses = ['Math', 'Science'];
  // export let loadedCourses = [];
	const types = ['Assignment', 'Test', 'Other'];

	async function openModal() {
    isOpen = true;
    await loadCourses(); // Load courses when modal opens
  }

	function closeModal() {
    modalTab = 'event';
		isOpen = false;
		description = '';
		selectedCourse = '';
		selectedType = '';
		showPreview = false;
    isEditingPreview = false;

    selectedCourseColor = '';
    newCourseName = '';
    newInstructor = '';
    classSlot1Day = '';
    classSlot1Start = '';
    classSlot1End = '';
    classSlot1Location = '';
    classSlot2Day = '';
    classSlot2Start = '';
    classSlot2End = '';
    classSlot2Location = '';
    courseDescription = '';

    previewTitle = '';
    previewStartDate = '';
    previewEndDate = '';
    previewStartTime = '';
    previewEndTime = '';
    previewLocation = '';
    allDay = false;
    previewFrequency = '';
    isRecurring = false;
    recurrencePattern = '';
	}

  async function handleDescriptionInput(event) {
    description = event.target.value;
    showPreview = description.trim().length > 0;

    if (!showPreview || isEditingPreview) return;

    try {
      const res = await fetch(import.meta.env.VITE_NER_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: description })
      });

      if (res.ok) {
        const data = await res.json();

        console.log(data)

        previewTitle = data.event_name || '';
        previewTitle = data.event_name || '';
        previewStartDate = data.parsed_start_date || '';
        previewEndDate = data.parsed_end_date || '';
        previewStartTime = data.parsed_start_time || '';
        previewEndTime = data.parsed_end_time || '';
        previewLocation = data.loc || '';
        previewLocation = data.loc || '';
        previewAllDay = !data.parsed_start_time && !data.parsed_end_time;
        previewFrequency = data.freq || '';
        recurrencePattern = data.recurrence_pattern || '';
        isRecurring = !!data.recurrence_pattern;
      } else {
        console.error("NER API error", res.status);
      }
    } catch (err) {
      console.error("Failed to call NER API", err);
    }
  }

  async function addEvent() {
    if (!selectedCourse || !previewTitle || !selectedType) {
      alert('Please select a course, type, and ensure the event has a title');
      return;
    }

    if (!auth.currentUser) {
      alert('Please log in first.');
      return;
    }

    // Find the full course object to get the color
    const courseObj = $coursesStore.find(c => c.title === selectedCourse);
    
    const isAllDay = previewAllDay || (!previewStartTime || !previewEndTime);

    const newEvent = {
      title: previewTitle,
      courseId: courseObj.id,
      courseTitle: selectedCourse,
      type: selectedType,
      description: description,
      startDate: previewStartDate || new Date().toISOString().split('T')[0],
      endDate: previewEndDate,
      startTime: previewStartTime,
      endTime: previewEndTime,
      location: previewLocation,
      color: courseObj.color,
      allDay: isAllDay,
      userId: auth.currentUser.uid,
      createdAt: serverTimestamp(),
      isRecurring: isRecurring,
      recurrencePattern: recurrencePattern,
      recurrenceEnds: null
    };

    try {
      await addDoc(collection(db, 'events'), newEvent);
      // console.log('Event saved:', newEvent);
      closeModal();
    } catch (e) {
      // console.error('Failed to save event:', e);
    }
  }
	// function addEvent() {
	// 	console.log('Add Event:', { description, selectedCourse, selectedType });
	// 	closeModal();
	// }
  
  let modalTab = 'event';

  const modalTabs = [
    { name: 'Add New Event', id: 'event' },
    { name: 'Add New Course', id: 'course' }
  ];

  // @ts-ignore
  function setModalTab(id) {
    modalTab = id;
  }

  let newCourseName = '';
  let newInstructor = '';
  let classSlot1Start = '';
  let classSlot1End = '';
  let classSlot1Location = '';
  let classSlot2Start = '';
  let classSlot2End = '';
  let classSlot2Location = '';
  let courseDescription = '';
  let allDay = false;

  async function addCourse() {
    if (!newCourseName.trim() || !selectedCourseColor) {
      alert('Course name and color are required.');
      return;
    }

    if (!auth.currentUser) {
      alert('Please log in first.');
      return;
    }

    const newCourse = {
      title: newCourseName,
      instructor: newInstructor,
      color: selectedCourseColor,
      schedule: [
        {
          day: classSlot1Day,
          start: classSlot1Start,
          end: classSlot1End,
          location: classSlot1Location
        },
        {
          day: classSlot2Day,
          start: classSlot2Start,
          end: classSlot2End,
          location: classSlot2Location
        }
      ],
      userId: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
      description: courseDescription
    };

    try {
      await addDoc(collection(db, 'courses'), newCourse);
      // console.log('Course saved:', newCourse);
      await coursesStore.load();
      onCourseAdded();
    } catch (e) {
      // console.error('Failed to save course:', e);
    }

    closeModal();
  }

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  let classSlot1Day = '';
  let classSlot2Day = '';

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

</script>

<!-- Trigger Button -->
<button
	on:click={!isDisabled ? openModal : null}
	class="bg-blue-600  text-white px-2 py-2 rounded-full shadow-white shadow-md hover:bg-blue-600 transition"
  disabled={isDisabled}
>
	<PlusOutline/>
</button>

<!-- Modal -->
{#if isOpen}
  <div
  class="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[9999]"
  on:click|self={closeModal}
  role="button"
  tabindex="0"
  on:keydown={(e) => {
    const target = e.target;
    if (target instanceof HTMLElement) {
      const tag = target.tagName.toLowerCase();
      if ((e.key === 'Enter' || e.key === ' ') && tag !== 'textarea' && tag !== 'input') {
        e.preventDefault();
        closeModal();
      }
    }
  }}
  aria-label="Close modal by clicking outside"
  >
    <div
    class="bg-white w-[90%] max-w-2xl rounded-md p-6 shadow-lg relative max-h-[90vh] overflow-y-auto custom-scrollbar z-[9999]"
    on:click|stopPropagation
    role="presentation"
    >
			<!-- Section 1: Title -->
			<!-- <h2 class="text-xl font-bold mb-4">Add New Event</h2> -->

      <!-- Modal Tabs Header -->
      <div class="bg-white mb-4 border-b border-gray-200 flex justify-center space-x-4 text-sm font-medium">
        {#each modalTabs as tab}
          <button
            class="px-4 py-2 border-b-2 transition-colors duration-200 
              {modalTab === tab.id 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-blue-500 hover:border-gray-300'}"
            on:click={() => setModalTab(tab.id)}
          >
            {tab.name}
          </button>
        {/each}
      </div>

      {#if modalTab === 'event'}
        <div class="mb-2 text-sm text-gray-600 bg-yellow-50 border border-yellow-300 rounded p-3 dark:text-yellow-200 dark:bg-yellow-900 dark:border-yellow-700">
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">
            <p>⚠️ We use NLP NER to extract event details. For best results:</p>
            <ul class="list-disc pl-5 mt-1 space-y-1">
              <li>Use prepositions between each event details (e.g. "Math test <em>on</em> May 1 <em>at</em> 2pm")</li>
              <li>Check the preview and edit if needed</li>
            </ul>
          </div>
        </div>
        <!-- Section 2: Textarea -->
        <textarea
          class="w-full p-3 border border-gray-300 rounded mb-4 resize-none"
          rows="3"
          placeholder="e.g. Math test on 1/5/2025 at 10am to 12pm at Lab 1"
          bind:value={description}
          on:input={handleDescriptionInput}
        ></textarea>

        <!-- Section 3: Label Selection -->
        <div class="flex flex-col gap-2 mb-4">
          <!-- Course -->
          <div class="flex items-center flex-wrap gap-2">
            <p class="font-semibold mr-2">Course <span class="text-red-500">*</span></p>
            {#if loadedCourses.length === 0}
              <p class="text-sm text-gray-500 italic">You haven't added any courses yet.</p>
            {:else}
              {#each loadedCourses as course}
                <button
                  type="button"
                  on:click={() => selectedCourse = course}
                  class={`px-3 py-1 rounded-full border ${
                    selectedCourse === course
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  {course}
                </button>
              {/each}
            {/if}
          </div>

          <!-- Type -->
          <div class="flex items-center flex-wrap gap-2">
            <p class="font-semibold mr-2">Type <span class="text-red-500">*</span></p>
            {#each types as type}
              <button
                type="button"
                on:click={() => selectedType = type}
                class={`px-3 py-1 rounded-full border ${
                  selectedType === type
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100'
                }`}
              >
                {type}
              </button>
            {/each}
          </div>
        </div>

        <!-- Section 4: Preview -->
        {#if showPreview}
        <div class="border border-blue-300 rounded pt-8 pr-4 pb-4 pl-4 mb-4 bg-blue-50 relative">
          <!-- Edit Icon -->
          <button
            on:click={() => isEditingPreview = !isEditingPreview}
            class="absolute top-2 right-2 text-gray-600 hover:text-blue-600 transition"
            aria-label="Edit event preview"
          >
            <PenSolid class="w-5 h-5" />
          </button>

          <!-- Editable or Read-Only Preview Fields -->
          {#if isEditingPreview}
            <div class="space-y-2">
              <div class="flex items-center gap-3">
                <label for="eventTitle" class="w-32 font-semibold">Event Title <span class="text-red-500">*</span></label>
                <input
                  id="eventTitle"
                  type="text"
                  class="flex-1 p-2 border rounded"
                  bind:value={previewTitle}
                />
              </div>
              <div class="flex items-center gap-3">
                <label for="startDate" class="w-32 font-semibold">Start Date</label>
                <input id="startDate" type="date" class="flex-1 p-2 border rounded" bind:value={previewStartDate} />
              </div>
              <div class="flex items-center gap-3">
                <label for="endDate" class="w-32 font-semibold">End Date</label>
                <input id="endDate" type="date" class="flex-1 p-2 border rounded" bind:value={previewEndDate} />
              </div>
              <div class="flex items-center gap-3">
                <label for="allDayToggle" class="w-32 font-semibold">All Day</label>
                <input
                  id="allDayToggle"
                  type="checkbox"
                  bind:checked={previewAllDay}
                  on:change={() => {
                    if (previewAllDay) {
                      previewStartTime = '';
                      previewEndTime = '';
                    }
                  }}
                />
              </div> 
              {#if !previewAllDay}             
              <div class="flex items-center gap-3">
                <label for="startTime" class="w-32 font-semibold">Start Time</label>
                <input id="startTime" type="time" class="flex-1 p-2 border rounded" bind:value={previewStartTime} />
              </div>
              <div class="flex items-center gap-3">
                <label for="endTime" class="w-32 font-semibold">End Time</label>
                <input id="endTime" type="time" class="flex-1 p-2 border rounded" bind:value={previewEndTime} />
              </div>
              {/if}              
              <div class="flex items-center gap-3">
                <label for="eventLocation" class="w-32 font-semibold">Location</label>
                <input
                  id="eventLocation"
                  type="text"
                  class="flex-1 p-2 border rounded"
                  placeholder="e.g. Lab 1"
                  bind:value={previewLocation}
                />
              </div>
              <div class="flex items-center gap-3">
                <label for="recurrenceToggle" class="w-32 font-semibold">Recurring Event</label>
                <input 
                    id="recurrenceToggle" 
                    type="checkbox" 
                    bind:checked={isRecurring}
                    class="w-4 h-4"
                />
              </div>
              {#if isRecurring}
              <div class="flex items-center gap-3">
                  <label for="recurrencePattern" class="w-32 font-semibold">Recurrence Pattern</label>
                  <select 
                      id="recurrencePattern" 
                      bind:value={recurrencePattern}
                      class="flex-1 p-2 border rounded"
                  >
                      {#each recurrenceOptions as option}
                          <option value={option.value}>{option.label}</option>
                      {/each}
                  </select>
              </div>
              {/if}
            </div>                
          {:else}
            <div class="space-y-1">
              <p><strong>Event Title <span class="text-red-500">*</span></strong> {previewTitle}</p>
              <p><strong>Date</strong> {previewStartDate}{previewEndDate ? ' to ' + previewEndDate : ''}</p>
              {#if previewAllDay == true}
                <p><strong>Time</strong> All Day</p>
              {:else}
                <p><strong>Time</strong> {previewStartTime}{previewEndTime ? ' to ' + previewEndTime : ''}</p>
              {/if}
              <!-- <p><strong>Time:</strong> {previewStartTime}{previewEndTime ? ' to ' + previewEndTime : ''}</p> -->
              <p><strong>Location</strong> {previewLocation || 'TBD'}</p>
              {#if previewFrequency}
                <p><strong>Frequency</strong> {previewFrequency}</p>
              {/if}
            </div>
          {/if}
        </div>
        {/if}

        <!-- Section 5: Action Buttons -->
        <div class="flex justify-end gap-3 mt-4">
          <button
            on:click={closeModal}
            class="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition"
          >Cancel</button>
          <button
            on:click={addEvent}
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >Add Event</button>
        </div>
        {:else if modalTab === 'course'}
          <div class="space-y-4">
            <!-- Course Name + Dropdown Color Picker -->
            <div class="flex flex-col md:flex-row gap-4 items-center">
              <!-- Course Name -->
              <div class="flex-1 flex items-center gap-3 w-full">
                <label for="courseName" class="w-20 font-semibold">Course Name <span class="text-red-500">*</span></label>
                <input
                  id="courseName"
                  type="text"
                  bind:value={newCourseName}
                  class="flex-1 p-2 border rounded"
                />
              </div>

              <!-- Dropdown Color Selector -->
              <div class="flex items-center gap-2 w-full md:w-auto">
                <label for="colorSelect" class="font-semibold">Color <span class="text-red-500">*</span></label>
                <!-- Select dropdown -->
                <select
                  id="colorSelect"
                  bind:value={selectedCourseColor}
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
              <input id="instructorName" type="text" bind:value={newInstructor} class="flex-1 p-2 border rounded" />
            </div>

            <!-- Class Slots Side-by-Side -->
            <div class="flex flex-col md:flex-row gap-4">
              <!-- Class Slot 1 -->
              <div class="flex-1 space-y-2">
                <p class="font-semibold">Class Slot 1</p>
                
                <!-- Day of the Week -->
                <div class="flex items-center gap-3">
                  <label for="slot1Day" class="w-20 font-semibold">Day</label>
                  <select id="slot1Day" bind:value={classSlot1Day} class="w-[12rem] p-2 border rounded">
                    <option value="" disabled selected>Select day</option>
                    {#each daysOfWeek as day}
                      <option value={day}>{day}</option>
                    {/each}
                  </select>
                </div>

                <!-- Time Start -->
                <div class="flex items-center gap-3">
                  <label for="slot1Start" class="w-20 font-semibold">Start</label>
                  <input id="slot1Start" type="time" bind:value={classSlot1Start} class="w-[12rem] p-2 border rounded"/>
                </div>

                <!-- Time End -->
                <div class="flex items-center gap-3">
                  <label for="slot1End" class="w-20 font-semibold">End</label>
                  <input id="slot1End" type="time" bind:value={classSlot1End} class="w-[12rem] p-2 border rounded" />
                </div>

                <!-- Location -->
                <div class="flex items-center gap-3">
                  <label for="slot1Location" class="w-20 font-semibold">Location</label>
                  <input id="slot1Location" type="text" bind:value={classSlot1Location} class="w-[12rem] p-2 border rounded" />
                </div>
              </div>

              <!-- Class Slot 2 -->
              <div class="flex-1 space-y-2">
                <p class="font-semibold">Class Slot 2</p>

                <!-- Day of the Week -->
                <div class="flex items-center gap-3">
                  <label for="slot2Day" class="w-20 font-semibold">Day</label>
                  <select id="slot2Day" bind:value={classSlot2Day} class="w-[12rem] p-2 border rounded">
                    <option value="" disabled selected>Select day</option>
                    {#each daysOfWeek as day}
                      <option value={day}>{day}</option>
                    {/each}
                  </select>
                </div>

                <!-- Time Start -->
                <div class="flex items-center gap-3">
                  <label for="slot2Start" class="w-20 font-semibold">Start</label>
                  <input id="slot2Start" type="time" bind:value={classSlot2Start} class="w-[12rem] p-2 border rounded" />
                </div>

                <!-- Time End -->
                <div class="flex items-center gap-3">
                  <label for="slot2End" class="w-20 font-semibold">End</label>
                  <input id="slot2End" type="time" bind:value={classSlot2End} class="w-[12rem] p-2 border rounded" />
                </div>

                <!-- Location -->
                <div class="flex items-center gap-3">
                  <label for="slot2Location" class="w-20 font-semibold">Location</label>
                  <input id="slot2Location" type="text" bind:value={classSlot2Location} class="w-[12rem] p-2 border rounded" />
                </div>
              </div>
            </div>

            <!-- Description -->
            <div class="flex items-start gap-3">
              <label for="courseDescription" class="w-20 font-semibold pt-2">Description</label>
              <textarea id="courseDescription" bind:value={courseDescription} rows="3" class="flex-1 p-2 border rounded"></textarea>
            </div>

            <!-- Save Button -->
            <div class="flex justify-end gap-3 mt-4">
              <button
                on:click={closeModal}
                class="px-4 py-2 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-100 transition"
              >Cancel</button>
              <button
                on:click={addCourse}
                class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >Save Course</button>
            </div>
          </div>
      {/if}      
		</div>
	</div>
{/if}

