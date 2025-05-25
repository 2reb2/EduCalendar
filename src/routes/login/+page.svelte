<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { auth } from '$lib/firebase';
    import { setSessionCookie } from '$lib/auth'; 

    async function handleLogin() {
        errorMessage = '';

        if (!username || !password) {
            errorMessage = 'Please enter username and password.';
            return;
        }

        try {
            // 1. Look up user by username
            const q = query(collection(db, 'users'), where('username', '==', username));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                errorMessage = 'No user found with that username.';
                return;
            }

            const userData = querySnapshot.docs[0].data();
            const userEmail = userData.email;

            // 2. Log in with the email retrieved from Firestore
            const userCredential = await signInWithEmailAndPassword(auth, userEmail, password);
            
            // 3. Set session cookie
            await setSessionCookie(userCredential.user);
            
            // 4. Redirect
            goto('/home');
        } catch (error) {
            errorMessage = error.message;
        }
    }

    onMount(() => {
        // If already logged in, redirect immediately
        if (auth.currentUser) {
            goto('/home');
        }
    });

    import { db } from '$lib/firebase';
    import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
    import { doc, setDoc } from 'firebase/firestore';
    import { collection, query, where, getDocs } from 'firebase/firestore';
    import '/src/app.css';

    let currentTab = 'login'; // Initial tab is 'login'

    let username = '';
    let password = '';
    let email = '';
    let confirmPassword = '';

    let errorMessage = '';
    let successMessage = '';

    // Function to toggle between login and signup tabs
    function switchTab(tab) {
        currentTab = tab;
        errorMessage = '';
        successMessage = '';

        username = '';
        password = '';
        email = '';
        confirmPassword = '';
        forgotPasswordUsername = '';
        forgotPasswordMessage = '';
        forgotPasswordIsError = false;
    }

    async function handleSignup() {
        errorMessage = '';
        successMessage = '';
        if (password !== confirmPassword) {
        errorMessage = 'Passwords do not match';
        return;
        }

        try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const uid = userCredential.user.uid;
        await setDoc(doc(db, 'users', uid), {
            username,
            email,
            createdAt: new Date()
        });
        successMessage = 'Signup successful! Please login.';
        currentTab = 'login';
        } catch (error) {
        errorMessage = error.message;
        }
    }

    import { sendPasswordResetEmail } from 'firebase/auth';

    let showForgotPassword = false;
    let forgotPasswordUsername = '';
    let forgotPasswordMessage = '';
    let forgotPasswordIsError = false;

    async function handleForgotPassword() {
        forgotPasswordMessage = '';
        forgotPasswordIsError = false;
        
        if (!forgotPasswordUsername) {
            forgotPasswordMessage = 'Please enter your username';
            forgotPasswordIsError = true;
            return;
        }

        try {
            // 1. Look up user by username to get email
            const q = query(collection(db, 'users'), where('username', '==', forgotPasswordUsername));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                forgotPasswordMessage = 'No user found with that username';
                forgotPasswordIsError = true;
                return;
            }

            const userData = querySnapshot.docs[0].data();
            const userEmail = userData.email;

            // 2. Send password reset email
            await sendPasswordResetEmail(auth, userEmail);
            
            forgotPasswordMessage = 'Password reset link sent to your email!';
            forgotPasswordIsError = false;
            
            // Close modal after 3 seconds
            setTimeout(() => {
                showForgotPassword = false;
                forgotPasswordMessage = '';
            }, 3000);
            
        } catch (error) {
            forgotPasswordMessage = error.message;
            forgotPasswordIsError = true;
        }
    }
</script>

<div class="h-screen flex flex-col justify-center items-center bg-gray-50 p-6">
<!-- First Section: Logo and Welcome Message -->
<img src="EduCalendar.png" alt="EduCalendar Logo" class="max-w-full h-auto pb-4" />
<h2 class="text-xl font-semibold text-gray-700">Welcome to EduCalendar!</h2>

<!-- Second Section: Login / Signup Form -->
<div class="w-full max-w-md mt-8 ">
    <!-- Tabs Header -->
    <div class="flex justify-center space-x-4 border-b border-gray-300 mb-6">
    <button 
        class="px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2"
        class:text-gray-600={currentTab === 'login'}
        class:text-gray-400={currentTab !== 'login'}
        class:border-gray-600={currentTab === 'login'}
        class:border-transparent={currentTab !== 'login'}
        on:click={() => switchTab('login')}
    >
        I have an account
    </button>
    <button 
        class="px-4 py-2 text-sm font-medium transition-all duration-200 border-b-2"
        class:text-gray-600={currentTab === 'signup'}
        class:text-gray-400={currentTab !== 'signup'}
        class:border-gray-600={currentTab === 'signup'}
        class:border-transparent={currentTab !== 'signup'}
        on:click={() => switchTab('signup')}
    >
        I am new here
    </button>
    </div>

    <!-- Form Content: Login or Signup -->
    {#if currentTab === 'login'}
    <div>
        <input 
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="text" 
            placeholder="Username" 
            bind:value={username} 
        />
        <input 
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="password" 
            placeholder="Password" 
            bind:value={password} 
        />

        <div class="text-left mb-4">
            <button 
                class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                on:click={() => showForgotPassword = true}
            >
                Forgot password?
            </button>
        </div>

        <button 
            type="button"
            class="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
            on:click={handleLogin}
        >
        Login
        </button>

        {#if errorMessage}
        <div class="mt-4 text-red-600 text-sm">{errorMessage}</div>
        {/if}
    </div>
    {:else}
    <div>
        <input 
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="email" 
            placeholder="Email" 
            bind:value={email} 
        />
        <input 
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="text" 
            placeholder="Username" 
            bind:value={username} 
        />
        <input 
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="password" 
            placeholder="Password" 
            bind:value={password} 
        />
        <input 
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            type="password" 
            placeholder="Confirm Password" 
            bind:value={confirmPassword} 
        />
        <button 
            type="button"
            class="w-full p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all duration-200"
            on:click={handleSignup}
        >
        Sign Up
        </button>

        {#if errorMessage}
        <div class="mt-4 text-red-600 text-sm">{errorMessage}</div>
        {/if}
        {#if successMessage}
        <div class="mt-4 text-green-600 text-sm">{successMessage}</div>
        {/if}
    </div>
    {/if}
</div>
{#if showForgotPassword}
<div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div class="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 class="text-lg font-semibold mb-4">Reset Password</h3>
        
        <p class="mb-4 text-sm text-gray-600">
            Enter your username and we'll send a password reset link to your registered email.
        </p>
        
        <input
            class="w-full p-3 mb-4 border border-gray-300 rounded-lg"
            type="text"
            placeholder="Username"
            bind:value={forgotPasswordUsername}
        />
        
        <div class="flex justify-end space-x-3">
            <button
                class="px-4 py-2 border border-gray-300 rounded-lg"
                on:click={() => showForgotPassword = false}
            >
                Cancel
            </button>
            <button
                type="button"
                class="px-4 py-2 bg-blue-600 text-white rounded-lg"
                on:click={handleForgotPassword}
            >
                Send Reset Link
            </button>
        </div>
        
        {#if forgotPasswordMessage}
        <div class="mt-4 text-sm {forgotPasswordIsError ? 'text-red-600' : 'text-green-600'}">
            {forgotPasswordMessage}
        </div>
        {/if}
    </div>
</div>
{/if}
</div>  