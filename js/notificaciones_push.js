const VAPID_PUBLIC_KEY = 'BPPZPBoW0giwTe1uicBClXTAYIpXmt-zYI4jR8Ov6W-o7zWFtaBWeAHi2KJRd8YFk04_V716dqecrPDBkhfslP4';

function urlBase64ToUnit8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray
}

async function inicializarNotificacionesPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
        console.warn('Este navegador no soporta notificaciones')
        return;
    }

    try {
        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });

        if (Notification.permission === 'granted') {
            await suscribirsePush(registration);
        }
    } catch (error) {
        console.error('Error registrando service worker:', error);
    }
}

async function solicitarPermisoNotificaciones() {
    if(!('serviceWorker' in navigator) || !('PushManager' in window)) {
        alert('Tu navegador no soporta notificaciones');
        return false
    }
    
    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') return false;
    
    const registration = await navigator.serviceWorker.ready;
    await suscribirsePush(registration);
    return true;
}

async function suscribirsePush(registration) {
    try {
        let subscription = await registration.pushManager.getSubscription();

        if (!subscription) {
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUnit8Array(VAPID_PUBLIC_KEY)
            });
        }

        const { data: { user } } = await supabaseClient.auth.getUser();
        if (!user) return;

        const json = subscription.toJSON();

        const { error } = await supabaseClient.rpc('reclamar_ppush_subscription', {
            p_endpoint: json.endpoint,
            p_p256dh: json.keys.p256dh,
            p_auth_key: json.keys.auth,
            p_user_agent: navigator.userAgent
        });
            
        
        if (error) console.error('Error guardando suscripcion push: ', error)
    } catch (error) {
        console.error('Error suscribiendo a push', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(inicializarNotificacionesPush, 1500);
});