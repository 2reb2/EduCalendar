// src/lib/stores/modal.js
import { writable, derived } from 'svelte/store';

export const activeModal = writable(null);

// Helper: Set a modal by name
export function setActiveModal(name) {
	return activeModal.set(name);
}

// Helper: Clear modal
export function clearModal() {
	return activeModal.set(null);
}

// Helper: Check if a specific modal is active
export function isModalActive(name) {
	return derived(activeModal, $modal => $modal === name);
}
