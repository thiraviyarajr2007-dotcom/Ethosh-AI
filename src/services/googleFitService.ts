/**
 * Google Fit Integration Service
 * Handles OAuth2 authentication and fetching fitness data.
 */

const GOOGLE_FIT_SCOPES = [
  'https://www.googleapis.com/auth/fitness.activity.read',
  'https://www.googleapis.com/auth/fitness.body.read',
  'https://www.googleapis.com/auth/fitness.location.read'
];

export function isGoogleFitConfigured(): boolean {
  return !!(import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
}

export async function signInGoogleFit(): Promise<string | null> {
  const clientId = (import.meta as any).env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) {
    console.error('VITE_GOOGLE_CLIENT_ID is not configured');
    return null;
  }

  // Use the Identity Services API or a simple redirect
  // For a web app, a popup/redirect is best.
  // This is a simplified version using the standard OAuth2 authorization code flow (implicit for tutorial/demo purposes)
  
  const redirectUri = window.location.origin;
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${encodeURIComponent(GOOGLE_FIT_SCOPES.join(' '))}`;

  return new Promise((resolve) => {
    const popup = window.open(authUrl, 'google-fit-auth', 'width=600,height=700');
    
    const checkPopup = setInterval(() => {
      if (!popup || popup.closed) {
        clearInterval(checkPopup);
        // Check if token was saved to localStorage by the sibling window/redirect
        const token = localStorage.getItem('google_fit_token');
        resolve(token);
      }
      
      try {
        if (popup && popup.location.hash) {
          const params = new URLSearchParams(popup.location.hash.substring(1));
          const accessToken = params.get('access_token');
          if (accessToken) {
            localStorage.setItem('google_fit_token', accessToken);
            popup.close();
            clearInterval(checkPopup);
            resolve(accessToken);
          }
        }
      } catch (e) {
        // Ignore cross-origin errors until redirect happens
      }
    }, 500);
  });
}

export async function fetchGoogleFitSteps(token: string): Promise<number> {
  const startTimeMillis = new Date().setHours(0, 0, 0, 0);
  const endTimeMillis = new Date().getTime();

  const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      aggregateBy: [{
        dataTypeName: 'com.google.step_count.delta',
        dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
      }],
      bucketByTime: { durationMillis: 86400000 },
      startTimeMillis,
      endTimeMillis
    })
  });

  if (!response.ok) {
    throw new Error('Failed to fetch steps from Google Fit');
  }

  const data = await response.json();
  let totalSteps = 0;
  if (data.bucket && data.bucket[0].dataset[0].point) {
    data.bucket[0].dataset[0].point.forEach((point: any) => {
      totalSteps += point.value[0].intVal;
    });
  }

  return totalSteps;
}
