# SOLDOWN - Video Downloader

**SOLDOWN** is a web-based platform for downloading online videos from various platforms with no size limits and flexible output format conversion.

![SOLDOWN](https://img.shields.io/badge/SOLDOWN-v1.0.0-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-v14+-green.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

## 🌟 Features

- **No Size Limits**: Download videos of any size without restrictions
- **Multiple Formats**: Choose from MP4, MP3, and various quality options
- **Fast & Reliable**: Lightning-fast downloads with 99.5% uptime target
- **Clean UI**: Beautiful, modern interface with splash screen animation
- **Responsive Design**: Works seamlessly on desktop and mobile devices
- **Secure**: HTTPS encrypted connections for your safety

## 🎯 Supported Platforms

- YouTube ✅ (Fully Supported)
- Vimeo (Coming Soon)
- Twitter/X (Coming Soon)
- Instagram (Coming Soon)
- TikTok (Coming Soon)
- Facebook (Coming Soon)

## 🚀 Quick Start

### Prerequisites

- Node.js v14 or higher
- npm or yarn
- FFmpeg (optional, for advanced conversions)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd soldown
```

2. Install dependencies:

```bash
npm install
```

**Note for Windows users:** If you encounter a Python-related error during installation, use:
```bash
npm run install-win
```

3. Create a `.env` file (optional):

```bash
PORT=3000
NODE_ENV=development
```

4. Start the server:

```bash
npm start
```

For development with auto-reload:

```bash
npm run dev
```

5. Open your browser and navigate to:

```
http://localhost:3000
```

Note: If port 3000 is in use, the server will automatically try the next available port (3001, 3002, etc.) and display the correct URL in the console.

## 📋 Usage

1. **Open SOLDOWN** in your browser
2. **Paste** a video URL into the input field
3. **Click Download** to analyze the video
4. **Select** your preferred format and quality
5. **Download** your file - it will start automatically!

## 🔧 Technology Stack

### Frontend

- HTML5, CSS3, JavaScript (Vanilla)
- Responsive design with mobile-first approach
- CSS animations for splash screen
- Google Fonts (Poppins, Inter)

### Backend

- Node.js with Express.js
- ytdl-core for YouTube video downloading
- Axios for HTTP requests
- CORS enabled for cross-origin requests

## 🗂️ Project Structure

```
soldown/
├── public/              # Frontend files
│   ├── index.html      # Main HTML file
│   ├── styles.css      # Styling and animations
│   └── app.js          # Frontend JavaScript
├── api/
│   └── index.js        # Express backend server
├── package.json         # Dependencies and scripts
├── .gitignore          # Git ignore rules
└── README.md           # This file
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
PORT=3000
NODE_ENV=development
```

### API Endpoints

- `GET /api/health` - Health check endpoint
- `POST /api/analyze` - Analyze video URL and get available formats
- `POST /api/download` - Download video in selected format

## ⚠️ Legal Disclaimer

**IMPORTANT**: This service is intended for downloading **personal, non-copyrighted content only**.

Users are responsible for:

- Respecting copyright laws
- Obtaining proper permissions before downloading
- Complying with the Terms of Service of video platforms
- Using downloaded content legally and ethically

The developers of SOLDOWN are not responsible for any misuse of this software or copyright violations by users.

## 🎨 Design

### Color Palette

- **Primary Blue**: #2D5BFF
- **Primary Teal**: #00C9B1
- **Accent Orange**: #FF6B35
- **Background**: #F5F7FA or #FFFFFF
- **Text**: #1A202C

### Typography

- **Headings**: Poppins (Bold)
- **Body**: Inter or System Font Stack

## 📈 Performance

- **PageSpeed Score**: Target >85
- **Core Web Vitals**: Optimized
- **Mobile Responsive**: Down to 320px width
- **Uptime Target**: >99.5%

## 🐛 Troubleshooting

### Common Issues

**Issue**: "Failed to analyze URL"

- **Solution**: Ensure the URL is from a supported platform and is publicly accessible

**Issue**: "Download failed"

- **Solution**: Check your internet connection and try again. Some videos may be restricted.

**Issue**: Port already in use

- **Solution**: Change the PORT in your `.env` file

## 🔮 Future Enhancements

- [ ] User accounts and download history
- [ ] Batch/playlist downloader
- [ ] Browser extension
- [ ] Advanced video editing features
- [ ] Premium subscription model
- [ ] Support for more platforms
- [ ] FFmpeg integration for advanced conversions

## 📝 Development

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Running Tests

```bash
npm test
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- ytdl-core for YouTube downloading capabilities
- Express.js for the web framework
- All open-source contributors

## 📞 Support

For issues and questions:

- Open an issue on GitHub
- Check the documentation
- Review the troubleshooting section

---

**Built with ❤️ for easy, reliable video downloads**

**Remember**: Use responsibly and respect copyright laws!
