# Frontend Setup and Usage

## Overview

The UK-TicketUpdater now includes a modern React-based web interface for managing ticket downloads, credentials, device profiles, and viewing history.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS
- **Icons**: Heroicons
- **HTTP Client**: Axios
- **Internationalization**: react-i18next (English, German, Russian)
- **UI Components**: Headless UI

## Directory Structure

```
frontend/
├── public/             # Static assets
├── src/
│   ├── components/     # Reusable components
│   │   ├── Layout.jsx         # Main layout with navigation
│   │   └── ProtectedRoute.jsx # Route protection HOC
│   ├── contexts/       # React contexts
│   │   └── AuthContext.jsx    # Authentication state management
│   ├── locales/        # i18n translations
│   │   ├── en.json            # English translations
│   │   ├── de.json            # German translations
│   │   └── ru.json            # Russian translations
│   ├── pages/          # Page components
│   │   ├── Login.jsx          # Login page
│   │   ├── Register.jsx       # Registration page
│   │   ├── Dashboard.jsx      # Main dashboard
│   │   ├── Credentials.jsx    # Credentials management
│   │   ├── DeviceProfiles.jsx # Device profiles management
│   │   ├── History.jsx        # Download history
│   │   ├── Tickets.jsx        # Downloaded tickets
│   │   ├── Profile.jsx        # User profile
│   │   └── Admin.jsx          # Admin panel
│   ├── services/       # API services
│   │   └── api.js             # API client with axios
│   ├── utils/          # Utility functions
│   ├── App.jsx         # Main app component
│   ├── main.jsx        # Application entry point
│   ├── i18n.js         # i18n configuration
│   └── index.css       # Global styles
├── .env.example        # Environment variables template
├── package.json        # Frontend dependencies
├── tailwind.config.js  # Tailwind configuration
├── postcss.config.js   # PostCSS configuration
└── vite.config.js      # Vite configuration
```

## Installation

1. Install frontend dependencies:
   ```bash
   cd frontend
   npm install
   ```

2. Create environment file (optional):
   ```bash
   cp .env.example .env
   ```

## Development

### Starting the Development Server

The frontend development server runs on port 5173 and proxies API requests to the backend on port 3000.

1. Start the backend API server in one terminal:
   ```bash
   # From project root
   JWT_SECRET=your-secret-key npm run api
   ```

2. Start the frontend dev server in another terminal:
   ```bash
   # From project root
   npm run dev:frontend

   # Or from frontend directory
   cd frontend
   npm run dev
   ```

3. Open your browser to http://localhost:5173

### Hot Module Replacement (HMR)

The development server supports HMR - changes to React components will be reflected immediately without a full page reload.

## Production Build

Build the frontend for production:

```bash
# From project root
npm run build:frontend

# Or from frontend directory
cd frontend
npm run build
```

The built files will be in `frontend/dist/` directory.

### Preview Production Build

```bash
# From project root
npm run preview:frontend

# Or from frontend directory
cd frontend
npm run preview
```

## Features

### Authentication & Authorization

- **Login**: Email and password authentication with JWT tokens
- **Registration**: Invite-only registration with token validation
- **Password Requirements**: Minimum 8 characters with uppercase, lowercase, and number
- **Protected Routes**: Automatic redirect to login for unauthenticated users
- **Admin Routes**: Special routes accessible only to admin users

### User Management

- **Profile Management**: View and edit user profile information
- **Language Selection**: Switch between English, German, and Russian
- **Role-Based Access**: Different views for admin and regular users

### Credentials Management

- **CRUD Operations**: Create, Read, Update, Delete ticket site credentials
- **Encrypted Storage**: Passwords encrypted before storage (backend)
- **Labels**: Optional labels for easy identification

### Device Profiles (Planned)

- **System Presets**: desktop_chrome, mobile_android, iphone_13, tablet_ipad
- **Custom Profiles**: Create custom device profiles with specific settings
- **Advanced Options**: Proxy, geolocation, viewport, timezone configuration

### Download Management (Planned)

- **Trigger Downloads**: Start ticket downloads with selected credentials
- **Status Tracking**: Real-time download status updates
- **History View**: Complete history of all download attempts

### Tickets (Planned)

- **View Tickets**: Access downloaded ticket HTML files
- **Download Tickets**: Download ticket files to local device
- **Ticket Management**: Organize and manage ticket files

### Admin Panel (Planned)

- **Invite Tokens**: Generate and manage invite tokens
- **User Management**: View all users and manage their accounts
- **User Control**: Enable/disable user accounts

## API Integration

The frontend communicates with the Express.js backend API through axios. The API client is configured in `src/services/api.js`.

### API Endpoints Used

- `POST /auth/login` - User login
- `POST /auth/register` - User registration with invite token
- `GET /credentials` - List user's credentials
- `POST /credentials` - Create new credential
- `PUT /credentials/:id` - Update credential
- `DELETE /credentials/:id` - Delete credential
- `GET /device-profiles` - List device profiles
- `POST /device-profiles` - Create device profile
- `PUT /device-profiles/:id` - Update device profile
- `DELETE /device-profiles/:id` - Delete device profile
- `POST /downloads` - Trigger ticket download
- `GET /history` - Get download history
- `GET /tickets/:userId` - Get user's tickets
- `POST /admin/invites` - Create invite token (admin)
- `GET /admin/invites` - List invite tokens (admin)
- `DELETE /admin/invites/:token` - Revoke invite token (admin)
- `GET /admin/users` - List all users (admin)
- `PUT /admin/users/:id/disable` - Disable user (admin)

### API Proxy Configuration

During development, API requests to `/api/*` are proxied to `http://localhost:3000` as configured in `vite.config.js`:

```javascript
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:3000',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, '')
    }
  }
}
```

## Internationalization (i18n)

The application supports three languages:

- **English (en)**: Default language
- **German (de)**: German translations
- **Russian (ru)**: Russian translations

### Changing Language

Users can change the language using the language selector in the top navigation bar. The selected language is persisted in localStorage.

### Adding New Languages

1. Create a new translation file in `src/locales/` (e.g., `fr.json`)
2. Copy the structure from an existing translation file
3. Translate all strings
4. Import the translation in `src/i18n.js`
5. Add the language option to the language selector in `Layout.jsx`

## Styling

The application uses Tailwind CSS for styling with a clean, modern design.

### Color Scheme

- Primary: Blue (blue-600, blue-700)
- Success: Green
- Error: Red
- Warning: Yellow
- Info: Purple

### Responsive Design

The interface is fully responsive and works well on:
- Mobile devices (< 640px)
- Tablets (640px - 1024px)
- Desktops (> 1024px)

## Security

### Token Storage

JWT tokens are stored in localStorage. For production, consider using httpOnly cookies for better security.

### API Request Interceptors

All API requests automatically include the JWT token in the Authorization header:

```javascript
Authorization: Bearer <token>
```

### Error Handling

401 (Unauthorized) responses automatically clear the token and redirect to login.

## Development Tips

### Environment Variables

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=/api
```

### Debugging

- React DevTools: Install the React DevTools browser extension
- Network Tab: Monitor API requests in browser DevTools
- Console: Check console for errors and warnings

### Code Organization

- Keep components small and focused
- Use custom hooks for reusable logic
- Extract API calls to services
- Use context for global state

## Deployment

### Static File Serving

The built frontend can be served as static files. Options include:

1. **Nginx**: Configure nginx to serve the dist/ directory
2. **Express**: Use express.static to serve from the backend
3. **CDN**: Upload to a CDN like Cloudflare or Vercel

### Backend Integration

To serve the frontend from the Express backend:

```javascript
// In src/server.js
const path = require('path');
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});
```

### Environment Configuration

For production, set the API base URL:

```env
VITE_API_BASE_URL=https://your-api-domain.com
```

## Known Issues

- Device profiles page is a placeholder and needs full implementation
- Tickets page needs integration with backend ticket file serving
- Admin panel needs full implementation with user management UI
- Download trigger interface needs to be implemented

## Future Improvements

- Add real-time download progress updates (WebSocket/SSE)
- Implement pagination for history and tickets lists
- Add search and filtering capabilities
- Improve mobile navigation UX
- Add dark mode support
- Implement ticket preview in-browser
- Add download scheduling features
- Enhance error messages with more context

## Contributing

When contributing to the frontend:

1. Follow the existing code style
2. Add translations for all new UI strings
3. Ensure responsive design on all screen sizes
4. Test with different user roles (admin/user)
5. Add comments for complex logic
6. Keep components modular and reusable

## Support

For issues or questions about the frontend, please check:
- Backend API documentation in the main README.md
- React documentation: https://react.dev/
- Vite documentation: https://vitejs.dev/
- Tailwind CSS documentation: https://tailwindcss.com/
