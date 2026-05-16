# Team Task Manager

A production-ready full-stack Team Task Manager with authentication, project management, task assignment, progress tracking, dashboard analytics, and role-based access control.

## Live deployment

Deploy backend and frontend separately on Railway.

- Backend service root: `backend`
- Frontend service root: `frontend`

## Tech stack

### Backend
- Node.js
- Express.js
- MongoDB with Mongoose
- JWT authentication
- Joi validation
- Helmet, CORS, rate limiting
- Jest + Supertest test setup

### Frontend
- React + Vite
- React Router
- Axios
- Modern responsive UI with CSS variables
- Protected routes and role-aware UI

## Features

- Signup and login
- Admin and Member roles
- JWT protected APIs
- Admin project CRUD
- Admin team/member management
- Admin task CRUD and assignment
- Member task status updates
- Dashboard cards for total, completed, pending, in-progress, and overdue tasks
- Project and task relationships
- Form validations on backend and frontend
- Railway deployment files

## Folder structure

```txt
team-task-manager/
  backend/
    src/
      config/
      controllers/
      middleware/
      models/
      routes/
      utils/
      validations/
      tests/
    package.json
    railway.json
    .env.example
  frontend/
    src/
      api/
      components/
      context/
      pages/
      styles/
      utils/
    package.json
    railway.json
    .env.example
```

## Backend setup

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

Backend runs on:

```txt
http://localhost:5000
```

## Frontend setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Frontend runs on:

```txt
http://localhost:5173
```

## Required environment variables

### Backend `.env`

```env
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/team-task-manager
JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
ADMIN_SEED_NAME=Admin
ADMIN_SEED_EMAIL=admin@example.com
ADMIN_SEED_PASSWORD=Admin@12345
```

### Frontend `.env`

```env
VITE_API_URL=http://localhost:5000/api
```

## API routes

### Auth

```txt
POST /api/auth/signup
POST /api/auth/login
GET /api/auth/me
```

### Users

```txt
GET /api/users
```

### Projects

```txt
POST /api/projects
GET /api/projects
GET /api/projects/:id
PUT /api/projects/:id
DELETE /api/projects/:id
POST /api/projects/:id/members
DELETE /api/projects/:id/members/:memberId
```

### Tasks

```txt
POST /api/tasks
GET /api/tasks
GET /api/tasks/:id
PUT /api/tasks/:id
DELETE /api/tasks/:id
PATCH /api/tasks/:id/status
```

### Dashboard

```txt
GET /api/dashboard
GET /api/dashboard/overdue
```

## Railway deployment

### Backend Railway service

1. Create a new Railway project.
2. Add a new service from GitHub.
3. Set root directory to `backend`.
4. Add backend environment variables.
5. Deploy.

### Frontend Railway service

1. Add another Railway service from same GitHub repo.
2. Set root directory to `frontend`.
3. Add `VITE_API_URL=https://your-backend-service.up.railway.app/api`.
4. Deploy.

## Demo credentials

Create users from the Signup page. Public signup creates Member accounts only.
Use the `ADMIN_SEED_*` environment variables to bootstrap an Admin on deployment.

Suggested test users:

```txt
Admin:
Email: admin@example.com
Password: Admin@12345
Role: Admin

Member:
Email: member@example.com
Password: Member@12345
Role: Member
```

## Submission format

```txt
Live URL: https://your-frontend-service.up.railway.app
GitHub Repo: https://github.com/your-username/team-task-manager
Admin Login: admin@example.com / Admin@12345
Member Login: member@example.com / Member@12345
```

## Notes

- Public signup creates Member accounts only.
- Admin accounts can be bootstrapped with the `ADMIN_SEED_*` environment variables on Railway.
- Admin can create, edit, and delete projects and tasks.
- Member can view assigned projects and tasks and update their own task status.
- All APIs return structured JSON errors.
- The app is ready for Railway deployment after adding MongoDB and environment variables.
