import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID,
      allowGuestAccess: true,
    },
  },
});
