# IT Equipment Request System

A comprehensive web application for managing IT equipment requests with Active Directory integration, built for Styrotech Corporation.

## Features

### 🔐 Authentication & Authorization
- **Active Directory Integration**: Seamless login with LDAP/AD credentials
- **Role-Based Access Control**: 5 user roles with specific permissions
  - Requestor: Create and track requests
  - Department Approver: Approve requests from their department
  - IT Manager: Final approval authority
  - Service Desk: Process approved requests
  - Super Administrator: Full system access

### 📋 Request Management
- **Digital Form**: Matches the original paper form (ITD-FM-001 rev.02 073025)
- **Dynamic Item Addition**: Add multiple equipment items per request
- **Equipment Categories**: Laptop, Desktop, Monitor, Keyboard, Mouse, UPS, Printer, Software, and more
- **Detailed Specifications**: Proposed specs, purpose, vendor info, replacement details
- **Priority Levels**: Low, Medium, High, Urgent

### 🔄 Workflow System
- **Linear Approval Process**: Requestor → Department Approver → IT Manager → Service Desk
- **Status Tracking**: Real-time status updates with detailed history
- **Actions**: Approve, Decline, Return for revision, Cancel
- **Notifications**: Email notifications for status changes (configurable)

### 📊 Dashboard & Reporting
- **Role-Specific Views**: Customized dashboards based on user role
- **Statistics**: Request counts by status, department, priority
- **Search & Filter**: Advanced filtering by status, date, department, requestor
- **Export Options**: PDF reports and data export

### 🔧 Administration
- **User Management**: Sync users from Active Directory
- **Department Management**: Hierarchical department structure
- **System Settings**: Configurable LDAP settings, email templates
- **Audit Trail**: Complete history of all actions and changes

## Technology Stack

### Backend
- **Node.js** with Express.js framework
- **PostgreSQL** database with Sequelize ORM
- **LDAPTS** for Active Directory integration
- **JWT** for session management
- **Nodemailer** for email notifications
- **Express Validator** for input validation

### Frontend
- **React 18** with modern hooks
- **React Router** for navigation
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Axios** for API communication
- **Vite** for build tooling

## Installation & Setup

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 12+
- Access to Active Directory server
- SMTP server for email notifications

### Backend Setup

1. **Navigate to backend directory:**
   ```bash
   cd item-req-backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Environment Variables:**
   ```env
   # Database
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=it_equipment_requests
   DB_USER=your_db_user
   DB_PASSWORD=your_db_password

   # LDAP/Active Directory
   LDAP_URL=ldap://your-domain-controller.company.com:389
   LDAP_BIND_DN=CN=service-account,OU=Service Accounts,DC=company,DC=com
   LDAP_BIND_PASSWORD=service_account_password
   LDAP_BASE_DN=DC=company,DC=com
   LDAP_USER_SEARCH_BASE=OU=Users,DC=company,DC=com

   # JWT
   JWT_SECRET=your_super_secret_jwt_key_here
   JWT_EXPIRES_IN=24h

   # Email (optional)
   SMTP_HOST=smtp.company.com
   SMTP_PORT=587
   SMTP_USER=noreply@company.com
   SMTP_PASSWORD=smtp_password
   ```

5. **Test LDAP connection:**
   ```bash
   node test-ldap.js
   ```

6. **Start the server:**
   ```bash
   npm run dev
   ```

### Frontend Setup note

1. **Navigate to frontend directory:**
   ```bash
   cd item-req-frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your API URL
   ```

4. **Environment Variables:**
   ```env
   VITE_API_URL=http://localhost:3001/api
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

### Database Setup

1. **Create PostgreSQL database:**
   ```sql
   CREATE DATABASE it_equipment_requests;
   CREATE USER your_db_user WITH PASSWORD 'your_db_password';
   GRANT ALL PRIVILEGES ON DATABASE it_equipment_requests TO your_db_user;
   ```

2. **The application will automatically create tables on first run**

### Initial User Sync

1. **Access the application at http://localhost:5173**
2. **Login with a Super Administrator AD account**
3. **Navigate to Settings → Sync Users to populate the database**

## Usage Guide

### For Requestors
1. **Login** with your AD credentials
2. **Create Request** by clicking "New Request"
3. **Fill out the form** with equipment details
4. **Save as Draft** or **Submit** for approval
5. **Track Progress** on the dashboard

### For Department Approvers
1. **Review requests** from your department on the dashboard
2. **Click on a request** to view details
3. **Approve, Decline, or Return** with comments
4. **Monitor department statistics**

### For IT Managers
1. **Review department-approved requests**
2. **Make final approval decisions**
3. **View system-wide statistics**
4. **Manage user roles** (if Super Admin)

### For Service Desk
1. **Process IT Manager approved requests**
2. **Update processing status**
3. **Mark requests as completed**
4. **Add processing notes and completion dates**

### For Super Administrators
1. **Full system access** and management
2. **User and department management**
3. **System configuration**
4. **LDAP synchronization**
5. **Audit and reporting**

## API Documentation

### Authentication Endpoints
- `POST /api/auth/login` - Login with AD credentials
- `GET /api/auth/profile` - Get current user profile
- `POST /api/auth/logout` - Logout
- `GET /api/auth/test-ldap` - Test LDAP connection (Admin only)

### Request Endpoints
- `GET /api/requests` - List requests (filtered by role)
- `POST /api/requests` - Create new request
- `GET /api/requests/:id` - Get request details
- `PUT /api/requests/:id` - Update request (draft only)
- `POST /api/requests/:id/submit` - Submit request for approval
- `POST /api/requests/:id/approve` - Approve request
- `POST /api/requests/:id/decline` - Decline request
- `POST /api/requests/:id/return` - Return for revision

### User Management Endpoints
- `GET /api/users` - List users (Admin/IT Manager only)
- `POST /api/users/sync` - Sync all users from AD (Admin only)
- `PATCH /api/users/:id/role` - Update user role (Admin only)

### Department Endpoints
- `GET /api/departments` - List departments
- `GET /api/departments/hierarchy/tree` - Get department tree

## Security Features

- **JWT Authentication** with secure token handling
- **Role-based authorization** on all endpoints
- **Input validation** and sanitization
- **Rate limiting** on sensitive operations
- **CORS protection** with configurable origins
- **Helmet.js** for security headers
- **SQL injection protection** via Sequelize ORM

## Deployment

### Production Considerations
1. **Use HTTPS** for all communications
2. **Configure proper CORS** origins
3. **Set strong JWT secrets**
4. **Use environment variables** for all sensitive data
5. **Configure proper database permissions**
6. **Set up log rotation** and monitoring
7. **Use reverse proxy** (nginx/Apache) for static files

### Docker Deployment (Optional)
```dockerfile
# Backend Dockerfile example
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

1. **LDAP Connection Failed**
   - Verify LDAP_URL is accessible
   - Check firewall settings (port 389/636)
   - Validate service account credentials
   - Test with `node test-ldap.js`

2. **Database Connection Error**
   - Verify PostgreSQL is running
   - Check database credentials
   - Ensure database exists and user has permissions

3. **Authentication Issues**
   - Verify JWT_SECRET is set
   - Check token expiration settings
   - Ensure user exists in database (run user sync)

4. **Permission Denied**
   - Verify user role assignments
   - Check department associations
   - Ensure user is active in AD

### Logs and Debugging
- Backend logs are output to console
- Enable debug mode with `NODE_ENV=development`
- Check browser console for frontend errors
- Use network tab to debug API calls

## Contributing

1. **Fork the repository**
2. **Create a feature branch**
3. **Make your changes**
4. **Add tests** if applicable
5. **Submit a pull request**

### Code Style
- Use ESLint configuration provided
- Follow React best practices
- Use meaningful commit messages
- Document new features

## License

This project is proprietary software developed for Styrotech Corporation.

## Support

For technical support or questions:
- **Internal IT Team**: Contact your system administrator
- **Developer**: Check the issue tracker or contact the development team

---

**Version**: 1.0.0  
**Last Updated**: October 2024  
**Developed for**: Styrotech Corporation - Packaging Solutions
