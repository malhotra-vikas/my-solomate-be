// delete-users.mjs

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const USERS_ENDPOINT = `${SUPABASE_URL}/rest/v1/users`;

export const handler = async () => {
    try {
        const now = new Date().toISOString();

        const headers = {
            'apikey': SUPABASE_SERVICE_ROLE_KEY ?? '',
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY ?? ''}`,
            'Content-Type': 'application/json',
        };

        // Step 1: Fetch users to delete
        const query = `?select=id&status=eq.To%20Be%20Deleted&marked_delete_date=lt.${encodeURIComponent(now)}`;
        console.log('fetching users eligible to be deleted with query: ', query);

        const fetchResponse = await fetch(`${USERS_ENDPOINT}${query}`, { method: 'GET', headers });

        if (!fetchResponse.ok) {
            const errText = await fetchResponse.text();
            console.error('Error fetching users:', errText);
            return { statusCode: 500, body: 'Error fetching users' };
        }

        const users = await fetchResponse.json();
        if (!Array.isArray(users) || users.length === 0) {
            return { statusCode: 200, body: 'No users to delete' };
        }

        console.log('Count of Users to be deleted: ', users.length);

        const ids = users.map(u => u.id);
        const patchUrl = `${USERS_ENDPOINT}?id=in.(${ids.join(',')})`;

        const patchResponse = await fetch(patchUrl, {
            method: 'PATCH',
            headers: {
                ...headers,
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({
                status: 'Deleted',
                deleted_at: now
            })
        });

        if (!patchResponse.ok) {
            const errText = await patchResponse.text();
            console.error('Error updating users:', errText);
            return { statusCode: 500, body: 'Error updating users' };
        }
        console.log(`Marked ${ids.length} user(s) as deleted.`);
        console.log(`Marked ${ids} user(s) as deleted.`);

        return {
            statusCode: 200,
            body: `Marked ${ids.length} user(s) as deleted.`
        };
    } catch (err) {
        console.error('Unexpected error:', err);
        return { statusCode: 500, body: 'Internal error' };
    }
};
