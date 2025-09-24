# Routing Structure

This directory contains the routing configuration for the React application using React Router v7.

## Structure

- `AppRoutes.jsx` - Main routing configuration using `createBrowserRouter`
- `README.md` - This documentation file

## Route Organization

### Public Routes
- `/` - Home page
- `/mvp` - MVP page

### Authentication Routes (`/auth`)
- `/auth/login` - Login page (wrapped in AuthLayout)

### Admin Routes (`/admin`)
- `/admin/dashboard` - Dashboard (wrapped in AdminLayout)
- `/admin/users` - Users management
- `/admin/audio-telephony` - Audio telephony features
- `/admin/settings` - Settings page

## Layouts

- **AuthLayout** - Clean, centered layout for authentication pages
- **AdminLayout** - Full-featured admin layout with sidebar navigation and header

## Redirects

- `/login` → `/auth/login`
- `/dashboard` → `/admin/dashboard`
- `*` (catch-all) → `/` (home)

## Usage

The routing is configured in `App.jsx` using `RouterProvider` with the `AppRoutes` configuration.
