<script>
	import { onMount, onDestroy } from 'svelte';
    import { db, auth } from '$lib/firebase';
    import { collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
    import { onAuthStateChanged } from 'firebase/auth';
    import { doc, getDoc } from 'firebase/firestore';

    import { activeModal } from '$lib/stores/modal';

    let { userCourses = [], coursesTabRef, children } = $props();
    let loadedCourses = []; // local state for mutation

	// async function loadCourses() {
	// 	if (!auth.currentUser) return;
	// 	const q = query(collection(db, 'courses'), where('userId', '==', auth.currentUser.uid));
	// 	const querySnapshot = await getDocs(q);

	// 	loadedCourses = [];
	// 	querySnapshot.forEach(doc => {
	// 		loadedCourses.push({ id: doc.id, ...doc.data() });
	// 	});
	// }

    // Add user state
    let currentUser = $state(null);
    let userData = $state(null);

    async function fetchUserData(userId) {
        if (!userId) return null;
        try {
            const userDoc = await getDoc(doc(db, 'users', userId));
            return userDoc.exists() ? userDoc.data() : null;
        } catch (error) {
            console.error("Error fetching user data:", error);
            return null;
        }
    }

    import courses from '$lib/stores/courses.js';

    async function loadCourses() {
        if (!auth.currentUser) return;
            const q = query(collection(db, 'courses'), where('userId', '==', auth.currentUser.uid));
            const querySnapshot = await getDocs(q);

            const loaded = [];
            querySnapshot.forEach(doc => {
            loaded.push({ id: doc.id, ...doc.data() });
            });
            courses.set(loaded); // update shared store
        }

        // Call loadCourses when the layout mounts
        onMount(() => {
            loadCourses();
    });

    import { eventsStore } from '$lib/stores/events.js';
    let unsubscribeEvents;

    async function loadEvents() {
        if (!auth.currentUser) return;
        
        const q = query(
        collection(db, 'events'),
        where('userId', '==', auth.currentUser.uid),
        orderBy('startDate')
        );

        unsubscribeEvents = onSnapshot(q, (snapshot) => {
        const events = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        eventsStore.set(events);
        });
    }

    onMount(() => {
        console.log('[Layout] Component mounted');
        const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
            console.log('[Layout] Auth state changed, user:', user?.uid);
            currentUser = user;
            if (user) {
                console.log('[Layout] User logged in, loading data');
                userData = await fetchUserData(user.uid);
                console.log('[Layout] User data loaded:', userData);
                await courses.load(); // Wait for courses to load
                console.log('[Layout] Courses loaded, now loading events');
                // loadEvents(); // Then load regular events
            } else {
                console.log('[Layout] No user, clearing stores');
                userData = null;
                courses.set([]);
                eventsStore.set([]);
            }
        });
        
        return () => {
            console.log('[Layout] Unmounting');
            unsubscribeAuth();
            if (unsubscribeEvents) unsubscribeEvents();
        };
    });
    // onMount(() => {
    //     loadCourses();
    //     loadEvents(); // Load events when layout mounts
    // });

    onDestroy(() => {
        if (unsubscribeEvents) unsubscribeEvents();
    });

    import '/src/app.css';
	
	import Header from '$lib/components/Header.svelte';
    import ProfileTab from '$lib/components/ProfileTab.svelte'
	// import DonutChart from '$lib/components/DonutChart.svelte';
	// import OverviewList from '$lib/components/OverviewList.svelte';
	import CalendarTab from '$lib/components/CalendarTab.svelte';
	import CoursesTab from '$lib/components/CoursesTab.svelte';
    import AddEventModal from '$lib/components/AddEventModal.svelte';

    import { 
        HomeSolid, HomeOutline,
        CalendarWeekSolid, CalendarWeekOutline,
        BookSolid, BookOutline
    } from 'flowbite-svelte-icons';

    let activeTab = $state('homepage');

    const tabs = [
        { name: 'Homepage', id: 'homepage', icon: HomeSolid },
        { name: 'Calendar', id: 'calendar', icon: CalendarWeekSolid },
        { name: 'Courses', id: 'courses', icon: BookSolid }
    ];

    // @ts-ignore
    function setActiveTab(id) {
        activeTab = id;
    }
</script>

<div class="body h-screen flex flex-col overflow-hidden"> 
    <Header userName={userData?.username || currentUser?.email || 'Guest'}/>
    <!-- Tabs Header -->
    <div class="text-sm font-medium border-b border-gray-200 flex space-x-4">
        {#each tabs as tab}
            <button
            class="px-4 py-2 text-sm border-b-2 flex items-center gap-2 transition-colors duration-200
                {activeTab === tab.id 
                ? 'text-blue-600 border-blue-600' 
                : 'text-gray-500 border-transparent hover:text-blue-500 hover:border-gray-300'}"
            onclick={() => setActiveTab(tab.id)}
            > 
            <svelte:component this={tab.icon} class="w-4 h-4" />
            {tab.name}
            </button>
        {/each}
    </div>

    <!-- Tabs Content -->
    <div class="flex-1 overflow-hidden p-1 pl-4 pr-4 pb-4 text-sm text-gray-500 dark:text-gray-400"> <!-- Changed this line -->
        {#if activeTab === 'homepage'}
            <div class="h-full flex"> <!-- Changed this line -->
                <!-- <div class="homepage-overview w-[30%] flex flex-col space-y-4 pr-4 ">
                    <div class="homepage-ring h-[30%] pt-3">
						<DonutChart></DonutChart>
                    </div>
                    <div class="hompage-list flex-1 overflow-hidden"> 
						<OverviewList></OverviewList>
                    </div>
                </div>
                <div class="homepage-calendar w-[70%] p-2 flex flex-col"> 
                    <Calendar bind:this={calendarRef} plugins={[TimeGrid, Interaction]} {options} class="flex-1"/>
                </div> -->
                <ProfileTab></ProfileTab>
            </div>
        {:else if activeTab === 'calendar'}
            <div class="p-2 pl-4 pr-4 h-full">
				<CalendarTab></CalendarTab>
            </div>
        {:else if activeTab === 'courses'}
            <div class="p-2 pl-4 pr-4 h-full">
				<CoursesTab bind:this={coursesTabRef} ></CoursesTab>
            </div>
        {/if}
    </div>
    <div class="fixed bottom-4 right-4 z-[9990]">
        <AddEventModal onCourseAdded={loadCourses} isDisabled={$activeModal === 'eventDetail'}/>
	</div>
    <style>
    :global(.fc .fc-now-indicator) {
        z-index: 1 !important;
    }
    :global(.fc-timegrid-now-indicator-line) {
        z-index: 1 !important;
    }
    :global(.fc-timegrid-now-indicator-arrow) {
        z-index: 1 !important;
    }
    </style>
</div>

<!-- {@render children()} -->
  