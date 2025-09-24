# Museum of Words - Deployment Guide

This guide covers everything you need to deploy the Museum of Words vector visualizer to production.

## 🚀 Quick Deployment

### Option 1: Automated Script (Recommended)
```bash
npm run deploy
```
This runs the automated deployment script that handles building and provides deployment options.

### Option 2: Manual Build
```bash
# Build for production
npm run build

# Preview locally (optional)
npm run preview

# Deploy to your chosen platform
```

## 📋 Pre-deployment Checklist

- [x] ✅ Build configuration optimized for production
- [x] ✅ TypeScript warnings handled (non-blocking)
- [x] ✅ Code splitting implemented (vendor, math, three, tokenizer chunks)
- [x] ✅ Static assets optimized
- [x] ✅ Security headers configured
- [x] ✅ SPA routing configured
- [x] ✅ Production README created
- [x] ✅ GitHub Actions CI/CD pipeline ready
- [x] ✅ Multiple platform configs (Vercel, Netlify, GitHub Pages)

## 🌐 Platform-Specific Deployment

### Vercel (Recommended)
```bash
# Deploy to Vercel
npm run deploy:vercel

# Or using their CLI directly
npx vercel --prod
```

**Features:**
- ✅ Zero-config deployment
- ✅ Automatic HTTPS
- ✅ Global CDN
- ✅ Preview deployments for PRs
- ✅ Environment variables support

### Netlify
```bash
# Deploy to Netlify
npm run deploy:netlify

# Or drag-and-drop the dist/ folder to Netlify dashboard
```

**Features:**
- ✅ Continuous deployment
- ✅ Form handling
- ✅ Edge functions
- ✅ Split testing

### GitHub Pages
The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically deploys to GitHub Pages when you push to main/master branch.

**Setup:**
1. Enable GitHub Pages in repository settings
2. Set source to "GitHub Actions"
3. Push to main/master branch

### Surge.sh
```bash
# Deploy to Surge
npm run deploy:surge

# Custom domain
surge dist/ your-domain.com
```

**Features:**
- ✅ Simple command-line deployment
- ✅ Custom domains
- ✅ HTTPS support

### Traditional Web Hosting
1. Run `npm run build`
2. Upload the entire `dist/` folder to your web server
3. Configure your server to serve `index.html` for all routes (SPA mode)

## 🔧 Build Configuration

### Optimization Features
- **Code Splitting**: Separate chunks for vendor, math, three.js, and tokenizer
- **Tree Shaking**: Removes unused code automatically
- **Minification**: Using esbuild for fast, efficient compression
- **Asset Optimization**: Images and static files are optimized
- **ES2015 Target**: Broad browser compatibility

### Bundle Analysis
After building, you'll see chunk sizes:
- `vendor.js` (~142KB): React and React DOM
- `math.js` (~107KB): ML-PCA and UMAP algorithms
- `three.js` (~488KB): Three.js 3D engine
- `tokenizer.js` (~1.7MB): GPT-4 tokenizer (largest but cacheable)
- `index.js` (~183KB): Application code

## 🔒 Security Configuration

### Headers Configured
- `Cross-Origin-Embedder-Policy: require-corp`
- `Cross-Origin-Opener-Policy: same-origin`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`

### Content Security Policy (Optional)
Add to your hosting provider if needed:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:;
```

## 🌍 Environment & Browser Support

### Supported Browsers
- Chrome/Edge 88+
- Firefox 85+
- Safari 14+
- Mobile browsers with ES2015 support

### Performance Considerations
- **First Load**: ~2.6MB total (including tokenizer)
- **Subsequent Loads**: Cached, < 100KB
- **Core Web Vitals**: Optimized for good scores
- **3D Performance**: Requires WebGL support

## 🐛 Troubleshooting

### Build Issues
```bash
# Clear cache and rebuild
rm -rf node_modules/.vite
rm -rf dist/
npm ci
npm run build
```

### TypeScript Warnings
The build is configured to continue despite TypeScript warnings. To fix them:
```bash
npm run typecheck
```

### Large Bundle Warning
The tokenizer chunk (~1.7MB) is expected due to GPT-4's vocabulary. This is normal and cached after first load.

### CORS Issues
If deploying to a subdirectory, update `vite.config.ts`:
```ts
export default defineConfig({
  base: '/your-subdirectory/',
  // ... rest of config
})
```

## 📊 Monitoring & Analytics

### Recommended Additions
- **Web Vitals**: Monitor Core Web Vitals performance
- **Error Tracking**: Sentry, LogRocket, or similar
- **Analytics**: Google Analytics, Plausible, or similar
- **User Feedback**: Hotjar, FullStory, or similar

### Performance Monitoring
```javascript
// Add to index.html if needed
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';
getCLS(console.log);
getFID(console.log);
getFCP(console.log);
getLCP(console.log);
getTTFB(console.log);
```

## 🔄 CI/CD Pipeline

The GitHub Actions workflow automatically:
1. ✅ Installs dependencies
2. ✅ Runs type checking
3. ✅ Runs linting
4. ✅ Builds the project
5. ✅ Deploys to GitHub Pages (on main/master)

### Extending the Pipeline
Add steps for:
- Unit tests
- E2E tests
- Security scanning
- Performance audits
- Deployment notifications

## 📈 Post-Deployment

### Verification Checklist
- [ ] Site loads correctly
- [ ] Tokenizer functionality works
- [ ] 3D visualization renders
- [ ] All tabs (Gallery, Matrix, 3D, Tokenizer) function
- [ ] Mobile responsiveness
- [ ] Performance meets expectations
- [ ] Console shows no critical errors

### Maintenance
- Keep dependencies updated
- Monitor bundle sizes
- Update tokenizer if needed
- Add new semantic presets
- Improve educational content

---

**🎉 Your Museum of Words is ready for the world!**