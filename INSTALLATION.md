# Installation Guide

## Step-by-Step Setup

### 1. Install Node.js

Make sure you have Node.js v14 or higher installed.

Check your version:

```bash
node --version
npm --version
```

If not installed, download from: https://nodejs.org/

### 2. Install Dependencies

```bash
npm install
```

This will install:

- express (web server)
- ytdl-core (YouTube downloader)
- cors (cross-origin support)
- axios (HTTP client)
- dotenv (environment variables)

### 3. Run the Application

**Development mode (with auto-reload):**

```bash
npm run dev
```

**Production mode:**

```bash
npm start
```

### 4. Access the Application

Open your web browser and go to:

```
http://localhost:3000
```

You should see the SOLDOWN splash screen!

## Troubleshooting

### Port Already in Use

If port 3000 is already in use, create a `.env` file in the root directory:

```env
PORT=3001
NODE_ENV=development
```

Then restart the server.

### Module Not Found Errors

If you encounter module not found errors:

```bash
rm -rf node_modules package-lock.json
npm install
```

### YouTube Downloads Not Working

The application uses `ytdl-core` which may need updates. To update:

```bash
npm update ytdl-core
```

## Production Deployment

For production deployment, consider:

1. Set `NODE_ENV=production` in `.env`
2. Use a process manager like PM2
3. Set up HTTPS/SSL certificates
4. Configure a reverse proxy (nginx)
5. Set up monitoring and logging

### Using PM2

```bash
npm install -g pm2
pm2 start server.js --name soldown
pm2 save
pm2 startup
```

## System Requirements

- Node.js: v14.0.0 or higher
- RAM: 512MB minimum, 1GB recommended
- Disk Space: 100MB minimum
- Network: Broadband connection recommended for downloads

## Security Notes

- Keep dependencies updated regularly
- Use HTTPS in production
- Implement rate limiting for production
- Add authentication if serving sensitive content
- Review and update the legal disclaimer regularly
