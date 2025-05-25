import { redirect } from '@sveltejs/kit';
import { getAuth } from 'firebase/auth';

export const load = async ({ url, cookies }) => {
    const { pathname } = url;
    
    // Skip auth check for login page
    if (pathname === '/login') {
        return {};
    }

    // Check for auth token in cookies (alternative approach)
    const session = cookies.get('session');
    
    if (!session) {
        throw redirect(302, '/login');
    }
    
    return {};
};