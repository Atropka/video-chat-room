import { createBrowserRouter } from 'react-router-dom';
import App from './App';
import { LobbyView } from './views/LobbyView';
import { RoomView } from './views/RoomView';
import { PrejoinView } from './views/PrejoinView';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LobbyView /> },
      { path: 'room/:roomId/prejoin', element: <PrejoinView /> },
      { path: 'room/:roomId', element: <RoomView /> },
    ],
  },
]);
