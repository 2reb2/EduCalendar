<script>
    import { onMount } from 'svelte';
    import { auth } from '$lib/firebase';
    import { goto } from '$app/navigation';

    // Client-side auth state sync (complementary to server-side checks)
    onMount(() => {
        return auth.onAuthStateChanged(user => {
            // This is just for real-time updates, the main redirects are handled server-side
        });
    });
</script>

<slot />