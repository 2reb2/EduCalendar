// import { writable } from 'svelte/store';
// export const eventsStore = writable([]);
// src/lib/stores/events.js
import { writable } from 'svelte/store';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '$lib/firebase';

function createEventsStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    set,
    update,
    // Add this new function to update events without breaking courses store
    updateEvent: async (eventId, updatedData) => {
      const eventRef = doc(db, 'events', eventId);
      await updateDoc(eventRef, updatedData);
      
      // Update both the events store and maintain course events
      update(events => events.map(event => 
        event.id === eventId ? { ...event, ...updatedData } : event
      ));
      
      return updatedData; // Return the updated data for potential course updates
    },
    deleteEvent: async (eventId) => {
      await deleteDoc(doc(db, 'events', eventId));
      update(events => events.filter(event => event.id !== eventId));
    }
  };
}

export const eventsStore = createEventsStore();
export const baseEventsStore = writable([]);