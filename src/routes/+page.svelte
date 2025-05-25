<script>
    import { goto } from '$app/navigation';
    import { auth } from '$lib/firebase';
    import { onMount } from 'svelte';

    onMount(() => {
        if (auth.currentUser) {
            goto('/home');
        } else {
            goto('/login');
        }
    });
</script>

<div class="flex items-center justify-center h-screen">
    <p>Redirecting...</p>
</div>