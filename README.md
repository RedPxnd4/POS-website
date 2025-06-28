# Comprehensive Point of Sale (POS) System

A full-featured Point of Sale system built with modern web technologies, designed for restaurants, cafes, and retail establishments.

## 🚀 Features

### Core POS Functionality
- **Order Management**: Create, edit, and track orders with real-time status updates
- **Menu Management**: Organize items by categories with customization options
- **Payment Processing**: Integrated Stripe payments with cash handling
- **Customer Management**: Track customer profiles, order history, and loyalty points
- **Inventory Tracking**: Real-time stock levels with low stock alerts
- **Staff Management**: Role-based access control (Admin, Manager, Staff)

### Security & Authentication
- **Secure Authentication**: JWT-based with refresh tokens
- **Two-Factor Authentication**: TOTP support with QR code setup
- **Role-Based Permissions**: Granular access control
- **Password Security**: Strong password requirements and hashing
- **Session Management**: Automatic timeout and security monitoring

### Business Intelligence
- **Sales Reports**: Daily, weekly, monthly analytics
- **Inventory Reports**: Stock levels, alerts, and supplier tracking
- **Customer Analytics**: Segmentation and loyalty insights
- **Staff Performance**: Order processing and sales metrics

### Technical Features
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Real-time Updates**: Live order status and inventory changes
- **Offline Capability**: Core functions work without internet
- **Print Integration**: Receipt printing and kitchen orders
- **Data Backup**: Automated backups with recovery procedures

## 🛠 Technology Stack

### Frontend
- **React 18+** with TypeScript
- **Tailwind CSS** for styling
- **Vite** for build tooling
- **React Router** for navigation
- **Context API** for state management

### Backend
- **Node.js** with Express.js
- **Supabase** (PostgreSQL) for database
- **JWT** for authentication
- **Stripe** for payment processing
- **Winston** for logging
- **Jest** for testing

### Infrastructure
- **Docker** containerization
- **Netlify** for deployment
- **GitHub Actions** for CI/CD
- **Environment-based configuration**

## 📋 Prerequisites

- Node.js 18+ and npm
- Supabase account and project
- Stripe account (for payments)
- Git for version control

## 🚀 Quick Start

### 1. Clone the Repository
```bash
git clone <repository-url>
cd comprehensive-pos-system
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Setup
Copy the example environment file and configure your settings:
```bash
cp .env.example .env
```

Fill in your environment variables:
```env
# Database Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_here
JWT_REFRESH_SECRET=your_super_secret_refresh_key_here

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

### 4. Database Setup
Run the database migrations to set up your schema:
```bash
# The migrations will be applied automatically when you connect to Supabase
# Make sure your Supabase project is set up and the connection details are correct
```

### 5. Start Development Server
```bash
npm run dev
```

The application will be available at:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000

### 6. Default Login Credentials
```
Admin: admin@pos.com / Admin123!
Manager: manager@pos.com / Admin123!
Staff: staff@pos.com / Admin123!
```

## 📖 Documentation

### API Documentation
The system provides a comprehensive REST API. Key endpoints include:

#### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/refresh` - Refresh access token
- `POST /api/auth/register` - Register new user (admin only)

#### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Create new order
- `PATCH /api/orders/:id/status` - Update order status
- `DELETE /api/orders/:id` - Cancel order

#### Menu Management
- `GET /api/menu/categories` - List menu categories
- `GET /api/menu/items` - List menu items
- `POST /api/menu/items` - Create menu item
- `PUT /api/menu/items/:id` - Update menu item

#### Customer Management
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer
- `PUT /api/customers/:id` - Update customer
- `POST /api/customers/:id/loyalty` - Add loyalty points

#### Inventory
- `GET /api/inventory` - List inventory items
- `POST /api/inventory` - Create inventory item
- `PATCH /api/inventory/:id/adjust` - Adjust stock levels
- `GET /api/inventory/alerts` - Get low stock alerts

#### Reports
- `GET /api/reports/sales` - Sales analytics
- `GET /api/reports/inventory` - Inventory reports
- `GET /api/reports/customers` - Customer analytics

### Database Schema
The system uses a PostgreSQL database with the following key tables:
- `users` - User accounts and authentication
- `customers` - Customer profiles and information
- `menu_categories` & `menu_items` - Menu structure
- `orders` & `order_items` - Order management
- `inventory_items` - Stock tracking
- `payments` - Payment transactions
- `audit_logs` - System activity logging

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Coverage
The system includes comprehensive test coverage for:
- Authentication and authorization
- Order processing workflows
- Payment handling
- Inventory management
- API endpoints and business logic

## 🔒 Security Features

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC)
- Two-factor authentication (2FA) support
- Password strength requirements
- Account lockout protection

### Data Security
- All data encrypted at rest and in transit
- SQL injection prevention
- XSS attack protection
- CSRF protection
- Input validation and sanitization

### Audit & Compliance
- Comprehensive audit logging
- User activity tracking
- PCI DSS compliance for payments
- GDPR compliance features
- Data backup and recovery

## 📊 Performance & Monitoring

### Performance Benchmarks
- API response time: < 500ms (95th percentile)
- Database query time: < 100ms (average)
- Page load time: < 2 seconds
- Payment processing: < 10 seconds

### Monitoring
- Application performance monitoring
- Error tracking and alerting
- Database performance metrics
- User activity analytics

## 🚀 Deployment

### Production Deployment
1. Build the application:
```bash
npm run build
```

2. Set production environment variables
3. Deploy to your hosting platform (Netlify, Vercel, etc.)
4. Configure your domain and SSL certificates

### Docker Deployment
```bash
# Build Docker image
docker build -t pos-system .

# Run container
docker run -p 3000:3000 --env-file .env pos-system
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow the existing code style and conventions
- Write tests for new features
- Update documentation as needed
- Ensure all tests pass before submitting

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Check the documentation
- Review existing issues
- Create a new issue with detailed information
- Contact the development team

## 🗺 Roadmap

### Upcoming Features
- [ ] Mobile app for staff
- [ ] Advanced analytics dashboard
- [ ] Multi-location support
- [ ] Integration with accounting software
- [ ] Voice ordering capabilities
- [ ] Kitchen display system
- [ ] Loyalty program enhancements
- [ ] Advanced reporting features

### Version History
- **v1.0.0** - Initial release with core POS functionality
- **v1.1.0** - Added inventory management and reporting
- **v1.2.0** - Enhanced security and 2FA support
- **v1.3.0** - Customer management and loyalty features

---

Built with ❤️ by the POS Development Team