importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyAzhZiUWu7snBkLbZvyroh3s-otx_s15c0',
  authDomain: 'synsyma-8fb76.firebaseapp.com',
  projectId: 'synsyma-8fb76',
  messagingSenderId: '36402765376',
  appId: '1:36402765376:web:0e311416edc96177c449a5',
})

// Starting messaging is enough. The browser shows the notification, and a click
// opens the link the server attached.
firebase.messaging()