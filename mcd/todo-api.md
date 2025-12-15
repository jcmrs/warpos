# TODO API - Main Context Document

## Project Overview

Build a RESTful API for managing TODO items using Express.js and Node.js.

## Goal

Create a production-ready TODO API with CRUD operations, input validation, error handling, and comprehensive tests.

## Core Requirements

### Endpoints

1. **GET /api/todos**
   - List all TODO items
   - Support filtering by status (pending/completed)
   - Return array of todo objects

2. **GET /api/todos/:id**
   - Get single TODO by ID
   - Return 404 if not found

3. **POST /api/todos**
   - Create new TODO
   - Required fields: title (string)
   - Optional fields: description (string), status (enum: pending/completed)
   - Return created TODO with generated ID

4. **PUT /api/todos/:id**
   - Update existing TODO
   - Allow updating title, description, status
   - Return updated TODO

5. **DELETE /api/todos/:id**
   - Delete TODO by ID
   - Return 204 on success

### Data Model

```typescript
interface Todo {
  id: string;           // UUID
  title: string;        // Required, max 200 chars
  description?: string; // Optional, max 1000 chars
  status: 'pending' | 'completed';
  createdAt: string;    // ISO 8601 timestamp
  updatedAt: string;    // ISO 8601 timestamp
}
```

### Technology Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js 4.x
- **Validation**: express-validator
- **Testing**: Jest + supertest
- **Data Storage**: In-memory array (for MVP)
- **Linting**: ESLint
- **Documentation**: OpenAPI/Swagger

## Constraints

### Code Quality
- RESTful API design principles
- Input validation on all endpoints
- Proper HTTP status codes (200, 201, 400, 404, 500)
- Error responses with clear messages
- 80%+ test coverage
- ESLint clean (no errors)

### Performance
- Response time < 100ms for CRUD operations
- Support at least 100 concurrent requests

### Security
- Input sanitization to prevent injection
- Rate limiting (100 req/min per IP)
- CORS configuration
- Helmet.js security headers

## Development Workflow

1. Create endpoint with route + handler + validation
2. Write tests (unit + integration)
3. Verify tests pass
4. Document endpoint
5. Test manually with curl/Postman

## Success Criteria

- [ ] All 5 CRUD endpoints implemented
- [ ] Input validation on POST/PUT
- [ ] Error handling with proper status codes
- [ ] Tests pass (>80% coverage)
- [ ] API documentation complete
- [ ] Manual testing successful
- [ ] ESLint clean

## Out of Scope (Future)

- Database persistence (use in-memory for now)
- User authentication
- TODO categories/tags
- Due dates and reminders
- Frontend application