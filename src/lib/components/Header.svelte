<script>
    export let userName;

    import { 
        UserCircleOutline,
        CogOutline,
        ArrowLeftOutline,
        ArrowLeftToBracketOutline,
        PenSolid,
        MoonOutline,
        SunOutline,
        BellOutline,
        InfoCircleOutline
    } from 'flowbite-svelte-icons';
    import { signOut } from 'firebase/auth';
    import { auth } from '$lib/firebase';
    import { sendPasswordResetEmail } from 'firebase/auth';
    import { fade } from 'svelte/transition';
    import { setSessionCookie, clearSessionCookie } from '$lib/auth'; 

    let showSettings = false;
    let showAbout = false;
    let darkMode = false;
    let notificationsEnabled = true;
    let showChangePassword = false;
    let settingsMessage = '';
    let isSettingsError = false;

    async function handleLogout() {
        try {
            await signOut(auth);
            await clearSessionCookie();
            window.location.href = '/login'; // Full reload to clear all state
        } catch (error) {
            settingsMessage = error.message;
            isSettingsError = true;
        }
    }

    async function handlePasswordChange() {
        try {
            const user = auth.currentUser;
            if (!user || !user.email) {
                throw new Error("User not authenticated");
            }

            // Send password reset email
            await sendPasswordResetEmail(auth, user.email);
            
            settingsMessage = "Password reset link sent to your email";
            isSettingsError = false;
            
            // Clear form and close after delay
            setTimeout(() => {
                showChangePassword = false;
                settingsMessage = '';
            }, 3000);
        } catch (error) {
            settingsMessage = error.message;
            isSettingsError = true;
        }
    }

    function toggleDarkMode() {
        darkMode = !darkMode;
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }
</script>

<div class="header text-sm font-medium p-5 pl-4 pr-4 text-gray-500 border-b border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300">
    <ul class="flex justify-between items-center">
        <li class="flex items-center">
            <div class="relative w-7 h-auto mr-2">
                <img src="favicon.png" alt="EduCalendar Icon" class="object-contain w-full " />
            </div>
            Hello, {userName || 'Guest'}
        </li>
        <li class="flex space-x-4">
            <button on:click={() => showAbout = true} class="ml-4">
                <InfoCircleOutline class="w-5 h-5 hover:text-blue-600 transition-colors" />
            </button>
            <button on:click={() => showSettings = true}>
                <CogOutline class="w-5 h-5 hover:text-blue-600 transition-colors" />
            </button>
        </li>
    </ul>
</div>

{#if showAbout}
<div class="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[9991]"
     on:click|self={() => showAbout = false}
     on:keydown={(e) => {
        // Only handle keys if not in an input/textarea/select
        const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        
        if (e.key === 'Escape') {
            showSettings = false;
        } else if ((e.key === 'Enter' || e.key === ' ') && !isTextInput) {
            e.preventDefault(); // Prevent space from scrolling the page
            showSettings = false;
        }
    }}
    role="button"
    tabindex="0"
    aria-label="Close modal"
    transition:fade>
     
    <div class="bg-white relative rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 dark:bg-gray-800 custom-scrollbar">
        <button
            on:click={() => showAbout = false}
            aria-label="Close About Modal"
            class="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        <div class="space-y-4">
            <div class="flex items-center mb-2">
                <img src="favicon.png" alt="Logo" class="w-auto h-8 mr-3"/>
                <h2 class="text-2xl font-bold dark:text-white">EduCalendar</h2>
            </div>
            
            <div class="prose dark:prose-invert">
                <p>
                    EduCalendar is a smart planner for students that simplifies scheduling using Natural Language Processing (NLP). Its Named Entity Recognition (NER) feature lets users input phrases like 
                    <span class="italic">"Math test on 1/5/2025 at 10am to 12pm at Lab 1"</span>
                    , and it automatically extracts key details—such as title, date, time, location, and frequency—into calendar events.
                </p>
                
                <p>
                    The goal of this integration is to:
                </p>

                <ul class="list-disc pl-5 space-y-1">
                    <li>Automatically create calendar events from natural language input</li>
                    <li>Enhance the user experience for students using daily planners</li>
                    <li>Save time on managing tasks, allowing users to focus more on completing them</li>
                </ul>
                
                <p class="mt-4">Built as a Final Year Project, EduCalendar utilizes:</p>
                <ul class="list-disc pl-5 space-y-1">
                    <li>NLP NER for automatic event creation</li>
                    <li>Sveltekit framework</li>
                    <li>Firebase</li>
                    <li>
                        <a 
                            href="https://github.com/vkurko/calendar" 
                            target="_blank" 
                            rel="noopener noreferrer"
                            class="text-blue-600 hover:underline dark:text-blue-400" >
                        vkurko/calendar</a> for calendar visualisation
                    </li>
                </ul>
            </div>
            
            <div class="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h4 class="font-medium dark:text-white">Developer</h4>
                <p>Rebecca Lai Yee Enn</p>
                <p>Computational Science, FCSIT, UNIMAS</p>
                <p>rebeccalaiyen@gmail.com</p>
                
                <h4 class="font-medium mt-3 dark:text-white">Supervisor</h4>
                <p>Ts. Dr Sarah Flora Anak Samson Juan</p>
                <p>Computational Science, FCSIT, UNIMAS</p>
                <p>sjsflora@unimas.my</p>
            </div>
        </div>
        
        <div class="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
            EduCalendar 2025 v1.0.0
        </div>
    </div>
</div>
{/if}
<!-- Settings Modal -->
{#if showSettings}
<div
    class="fixed inset-0 bg-[rgba(0,0,0,0.6)] flex items-center justify-center z-[9991]"
    on:click|self={() => showSettings = false}
    on:keydown={(e) => {
        // Only handle keys if not in an input/textarea/select
        const isTextInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
        
        if (e.key === 'Escape') {
            showSettings = false;
        } else if ((e.key === 'Enter' || e.key === ' ') && !isTextInput) {
            e.preventDefault(); // Prevent space from scrolling the page
            showSettings = false;
        }
    }}
    role="button"
    tabindex="0"
    aria-label="Close modal"
    transition:fade
>
    <div class="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto relative dark:bg-gray-800">
        <!-- Close Button (X icon) -->
        <button
            class="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 dark:hover:bg-gray-700"
            on:click={() => showSettings = false}
            aria-label="Close modal"
        >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>

        <div class="p-6">
            {#if !showChangePassword}
                <!-- Main Settings View -->
                <h3 class="text-xl text-gray-700 font-semibold mb-4 dark:text-white">Settings</h3>
                
                <div class="space-y-3">
                    <button 
                        on:click={() => showChangePassword = true}
                        class="w-full flex items-center p-3 text-left hover:bg-gray-100 rounded-lg transition-colors dark:hover:bg-gray-700"
                    >
                        <PenSolid class="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
                        <span class="dark:text-white">Change Password</span>
                    </button>

                    <button 
                        on:click={handleLogout}
                        class="w-full flex items-center p-3 text-left hover:bg-gray-100 rounded-lg transition-colors dark:hover:bg-gray-700"
                    >
                        <ArrowLeftToBracketOutline class="w-5 h-5 mr-2 text-gray-600 dark:text-gray-400" />
                        <span class="dark:text-white">Logout</span>
                    </button>
                </div>
            {:else}
                <!-- Change Password View -->
                <div class="space-y-4">
                    <div class="flex items-center mb-4">
                        <button 
                            on:click={() => showChangePassword = false} 
                            class="mr-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                            <ArrowLeftOutline class="w-5 h-5 text-gray-600 dark:text-gray-400" />
                        </button>
                        <h3 class="text-xl text-gray-700 font-semibold dark:text-white">Change Password</h3>
                    </div>
                    
                    <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        For security reasons, we'll send a password reset link to your registered email address.
                    </p>
                    
                    <button
                        on:click={handlePasswordChange}
                        class="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Send Password Reset Email
                    </button>

                    {#if settingsMessage}
                        <div class={`mt-4 p-3 rounded-lg ${isSettingsError ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100'}`}>
                            {settingsMessage}
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>
{/if}