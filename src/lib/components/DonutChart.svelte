<script>
  import { onMount, onDestroy } from 'svelte';
  import { derived } from 'svelte/store';
  import { Chart, DoughnutController, ArcElement, Tooltip, Legend } from 'chart.js';
  import { eventsStore } from '$lib/stores/events.js';
  import courses from '$lib/stores/courses.js';
  
  Chart.register(DoughnutController, ArcElement, Tooltip, Legend);

  let canvas;
  let chart;
  let unsubscribeEvents;
  let unsubscribeCourses;

  // Debugging logs
  let debugInfo = {
    events: [],
    courses: [],
    processedData: null
  };

  const defaultColors = [
    '#3b82f6', '#f59e0b', '#10b981', '#ef4444', 
    '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'
  ];

  function processData(events, courseData) {
    // console.log('Processing data - Events:', events);
    // console.log('Processing data - Courses:', courseData);

    const courseMap = new Map();
    
    // First create a map of course IDs to their data
    const courseIdMap = new Map();
    courseData?.forEach(course => {
      if (course?.id) {
        courseIdMap.set(course.id, {
          title: course.title,
          color: course.color || defaultColors[courseIdMap.size % defaultColors.length]
        });
      }
    });

    // Count events by course ID
    const counts = new Map();
    events?.forEach(event => {
      if (event?.courseId && courseIdMap.has(event.courseId)) {
        const count = counts.get(event.courseId) || 0;
        counts.set(event.courseId, count + 1);
      }
    });

    // Prepare sorted data using the most recent course info
    const sortedCourses = Array.from(counts.entries())
      .filter(([courseId]) => courseIdMap.has(courseId))
      .map(([courseId, count]) => ({
        ...courseIdMap.get(courseId),
        count
      }))
      .sort((a, b) => b.count - a.count);

    const result = {
      labels: sortedCourses.map(course => course.title),
      data: sortedCourses.map(course => course.count),
      backgroundColors: sortedCourses.map(course => course.color)
    };

    debugInfo.processedData = result;
    // console.log('Processed data:', result);
    return result;
  }

  function updateChart(events, courseData) {
    // console.log('Updating chart with:', { events, courseData });
    
    if (!events || !courseData) {
      // console.log('Missing data - events or courses not loaded');
      return;
    }

    const { labels, data, backgroundColors } = processData(events, courseData);
    
    if (labels.length === 0) {
      // console.log('No data to display');
      if (chart) {
        chart.destroy();
        chart = null;
      }
      return;
    }
    
    if (chart) {
      // console.log('Updating existing chart');
      chart.data.labels = labels;
      chart.data.datasets[0].data = data;
      chart.data.datasets[0].backgroundColor = backgroundColors;
      chart.update();
    } else {
      // console.log('Creating new chart');
      chart = new Chart(canvas, {
        type: 'doughnut',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: backgroundColors,
            borderWidth: 1
          }]
        },
        options: {
          plugins: {
            legend: {
              display: false,
              position: 'bottom',
              labels: {
                color: '#ffffff',
                font: { size: 10 }
              }
            }
          },
          cutout: '70%',
          responsive: true,
          maintainAspectRatio: false
        }
      });
    }
  }

  const combinedData = derived(
    [eventsStore, courses],
    ([$events, $courses]) => ({ events: $events, courses: $courses })
  );

  onMount(() => {
    // console.log('DonutChart mounted');
    
    const unsubscribe = combinedData.subscribe(({events, courses}) => {
      debugInfo.events = events;
      debugInfo.courses = courses;
      updateChart(events, courses);
    });
    
    return () => {
      unsubscribe();
      if (chart) chart.destroy();
    };
  });

  onDestroy(() => {
    // console.log('DonutChart unmounted');
    if (chart) chart.destroy();
    if (unsubscribeEvents) unsubscribeEvents();
    if (unsubscribeCourses) unsubscribeCourses();
  });
  // console.log(JSON.stringify(debugInfo, null, 2))
</script>

<div class="w-full h-full relative">
  <canvas bind:this={canvas}></canvas>
  
  {#if $courses && $courses.length === 0}
    <div class="absolute inset-0 flex items-center justify-center text-gray-500">
      No courses found - please add courses first
    </div>
  {:else if $eventsStore && $eventsStore.length === 0}
    <div class="absolute inset-0 flex items-center justify-center text-gray-500">
      No events to display
    </div>
  {:else if !debugInfo.processedData?.labels?.length}
    <div class="absolute inset-0 flex items-center justify-center text-gray-500">
      Loading data...
    </div>
  {/if}
</div>