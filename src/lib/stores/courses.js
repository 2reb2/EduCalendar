import { writable } from 'svelte/store';
import { collection, query, where, getDocs, doc, updateDoc, orderBy } from 'firebase/firestore';
import { db, auth } from '$lib/firebase';
import { eventsStore, baseEventsStore } from '$lib/stores/events.js';

function createCoursesStore() {
    const { subscribe, set, update } = writable([]);

    async function load() {
    //   console.log('[courses.js] Starting load()');
      if (!auth.currentUser) {
        //   console.log('[courses.js] No current user, aborting');
          return;
      }
      
      // Load courses
    //   console.log('[courses.js] Loading courses from Firestore');
      const coursesQuery = query(collection(db, 'courses'), where('userId', '==', auth.currentUser.uid));
      const coursesSnapshot = await getDocs(coursesQuery);
      const coursesData = coursesSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
      }));
    //   console.log('[courses.js] Loaded courses:', coursesData);

      // Load events
    //   console.log('[courses.js] Loading events from Firestore');
      const eventsQuery = query(
          collection(db, 'events'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('startDate')
      );
      const eventsSnapshot = await getDocs(eventsQuery);
      const allEvents = eventsSnapshot.docs.map(doc => ({ 
          id: doc.id, 
          ...doc.data() 
      }));
    //   console.log('[courses.js] Loaded regular events:', allEvents);

      // Generate class events
    //   console.log('[courses.js] Generating class events');
      const classEvents = generateClassEvents(coursesData);
    //   console.log('[courses.js] Generated class events:', classEvents);
      
      // Combine and set data
      const combinedEvents = [...allEvents, ...classEvents];
    //   console.log('[courses.js] Setting combined events to eventsStore');
      eventsStore.set(combinedEvents); // Update events store
      baseEventsStore.set(combinedEvents);

    //   console.log('[courses.js] Setting courses data with events');
      set(coursesData.map(course => ({
          ...course,
          events: combinedEvents.filter(event => event.courseId === course.id)
      })));
    //   console.log('[courses.js] Load completed');
    }

  // Helper function to generate class events
  function generateClassEvents(coursesData) {
    return coursesData.flatMap(course => {
        if (!course.schedule) return [];
        
        return course.schedule.flatMap(session => {
            if (!session.day || !session.start || !session.end) return [];
            
            const dayMap = {
                'sunday': 0, 'monday': 1, 'tuesday': 2, 
                'wednesday': 3, 'thursday': 4, 'friday': 5, 'saturday': 6
            };
            const dayNumber = dayMap[session.day.toLowerCase()];
            if (dayNumber === undefined) return [];

            return {
                id: `class-${course.id}-${session.day}`,
                title: `${course.title} Class`,
                startTime: session.start,
                endTime: session.end,
                location: session.location || '',
                color: course.color,
                isRecurring: true,
                recurrencePattern: session.day.toLowerCase(),
                startDate: course.createdAt || new Date().toISOString().split('T')[0],
                courseTitle: course.title,
                isClass: true,
                courseId: course.id
            };
        });
    });
  }

    async function updateCourse(courseId, updatedData) {
        const courseRef = doc(db, 'courses', courseId);
        await updateDoc(courseRef, updatedData);

        update(coursesList => 
            coursesList.map(course => 
                course.id === courseId ? { ...course, ...updatedData } : course
            )
        );
    }

    // Return both named methods and default export for compatibility
    const store = {
        subscribe,
        load,
        set,
        update,
        updateCourse
    };

    return store;
}

// Create the store instance
const coursesStore = createCoursesStore();

// Named export for new code
export const courses = coursesStore;

// Default export for backward compatibility
export default coursesStore;