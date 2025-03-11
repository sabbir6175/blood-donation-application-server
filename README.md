# Blood Donation Server side

This is the backend API for a blood donation platform that helps manage blood donation requests, users, and blog posts. The system uses JWT authentication for secure access and supports role-based access control (Admin, Volunteer, Donor).

## Blood Donation Server Setup Instructions

### Prerequisites

- Node.js (v20.18.0)
- MongoDB (Atlas or local MongoDB setup)
- JWT Secret Token

### Steps

1. **Clone the repository**:
    ```bash
    git clone https://github.com/sabbir6175/blood-donation-application-server.git
    cd blood-donation-application-server
    ```

2. **Install dependencies**:
    ```bash
     "@stripe/stripe-js": "^5.6.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2",
    "mongodb": "^6.12.0"
          /
      npm install
    ```

3. **Set up environment variables**:
    Create a `.env` file in the root directory and add the following:
    ```env
    DB_USER=your_mongodb_user
    DB_PASS=your_mongodb_password
    JWT_SECRET_TOKEN=your_jwt_secret_token
    ```

4. **Start the server**:
    ```bash
    nodemon index.js
    ```
    The server will run on port `3000` by default.
   

### Authentication Routes
- **POST /jwt**: Generate JWT token.
  - Request body:
    ```json
    {
      "email": "user@example.com",
      "password": "yourpassword"
    }
    ```
  - Response:
    ```json
    {
      "token": "your_jwt_token"
    }
    ```

### Donation Routes
- **GET /donationRequest/data**: Fetch all donation requests with status "inprogress".
- **GET /donationRequest**: Fetch all donation requests (can be filtered by `donationStatus` or `email`).
  - Query parameters: `donationStatus`, `email`
- **GET /donationRequest/:id**: Get a single donation request by its ID.
- **PATCH /donationRequestStatus/:id**: Update the status of a donation request by ID.
  - Request body:
    ```json
    {
      "donationStatus": "approved"
    }
    ```
- **PATCH /donationRequest/:id**: Update donation request details.
  - Request body: Donation details to update.
- **POST /donation-requests**: Create a new donation request.
  - Request body: Donation details.
- **GET /my-donation-requests**: Get all donation requests of the logged-in user (paginated).
  - Query parameters: `donationStatus`, `page`, `limit`

### User Routes
- **POST /users**: Create a new user (for registration).
  - Request body:
    ```json
    {
      "email": "user@example.com",
      "password": "yourpassword",
      "role": "donor"
    }
    ```
- **GET /users/:email**: Fetch user details by email.
- **PUT /users/block/:id**: Block a user (admin only).
- **PUT /users/unblock/:id**: Unblock a user (admin only).
- **PUT /users/make-admin/:id**: Make a user an admin (admin only).
- **PUT /users/make-volunteer/:id**: Make a user a volunteer (admin only).
- **PUT /users/:id**: Update user profile details (display name, photo URL, district, blood group, etc.).
- **GET /users/role/:email**: Check the role of a user.
  - Response:
    ```json
    {
      "admin": true,
      "volunteer": false,
      "donor": true
    }
    ```

### Blog Routes
- **POST /blogs**: Create a new blog post.
  - Request body:
    ```json
    {
      "title": "Blog Title",
      "content": "Blog Content",
      "date": "2025-03-11",
      "thumbnail": "image_url"
    }
    ```
- **GET /blogs/data**: Get all blogs (admin only).
- **GET /blogs/data/:id**: Get a single blog post by ID.
- **GET /blogs**: Get blogs by status (draft, published).
  - Query parameter: `status`
- **PUT /blogs/publish/:id**: Publish a blog (admin only).
- **PUT /blogs/unpublish/:id**: Unpublish a blog (admin only).
- **DELETE /blogs/:id**: Delete a blog (admin only).

### Admin Routes
- **GET /admin/users**: Get all users (paginated, admin only).
  - Query parameters: `status`, `page`, `limit`
- **GET /volunteer/user**: Get volunteer users (admin only).
  - Query parameters: `status`, `page`, `limit`

### Donation Funding Routes
- **POST /funding**: Process donation payments (via Stripe, planned feature).

## Authentication & Authorization

### JWT Authentication:
- All routes are protected with JWT.
- The token must be sent in the `Authorization` header as `Bearer <token>`.
- `verifyToken` middleware checks the validity of the token.
- `verifyAdmin`, `verifyVolunteer`, and `verifyDonor` middleware are used to check the user's role.

## Error Handling
- **400**: Bad request (e.g., missing required fields).
- **401**: Unauthorized access (e.g., invalid or missing token).
- **403**: Forbidden (e.g., access restricted to admins).
- **404**: Not found (e.g., resource does not exist).
- **500**: Server error.

