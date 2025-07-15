# Excel Grade Entry - Update Guide

## 📋 Complete Steps for Publishing New Updates

### Prerequisites
- Ensure you have a GitHub Personal Access Token with `repo` permissions
- Set the token as an environment variable: `GH_TOKEN=your_token_here`

### Step 1: Make Your Changes
1. Implement your new features or bug fixes
2. Test thoroughly in development mode:
   ```bash
   npm run electron-dev
   ```

### Step 2: Update Version Number
1. Open `package.json`
2. Update the version number following semantic versioning:
   - **Patch** (1.0.0 → 1.0.1): Bug fixes
   - **Minor** (1.0.0 → 1.1.0): New features
   - **Major** (1.0.0 → 2.0.0): Breaking changes

### Step 3: Commit Changes
```bash
git add .
git commit -m "feat: your new feature description"
git push origin main
```

### Step 4: Build and Publish
```bash
# Build the app and publish to GitHub releases
npm run publish

# Or build without publishing (for testing)
npm run dist
```

### Step 5: Create GitHub Release
1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Tag version: `v1.0.1` (must match package.json version)
4. Release title: `Version 1.0.1`
5. Describe changes in the release notes
6. Upload the files from `dist/` folder if not auto-uploaded

### Step 6: Verify Auto-Update
1. Users with older versions will receive an update notification
2. Check the logs in the console for update status
3. Test with a local build to ensure the update process works

## 🔄 Update Process Flow

1. **User Opens App** → Auto-updater checks for updates
2. **Update Found** → Beautiful notification appears
3. **User Accepts** → Update downloads in background
4. **Download Complete** → User prompted to restart
5. **Restart** → New version loads automatically

## 🚀 Quick Update Checklist

- [ ] Changes tested locally
- [ ] Version number updated in package.json
- [ ] Changes committed and pushed
- [ ] Run `npm run publish`
- [ ] GitHub release created
- [ ] Release notes written
- [ ] Update verified with test installation

## 🔧 Troubleshooting

### Common Issues:
- **Build fails**: Check for TypeScript errors, missing dependencies
- **Auto-updater not working**: Ensure GitHub token is set, release is published
- **Users not getting updates**: Check app signature, ensure version is higher

### Debug Commands:
```bash
# Build without publishing
npm run dist

# Test electron app
npm run electron-dev

# Check build configuration
npx electron-builder --help
```

## 📝 Version History Template

```markdown
## Version 1.0.1 - 2025-01-15

### New Features
- Added advanced undo/redo system
- Improved session storage
- Enhanced keyboard shortcuts

### Bug Fixes
- Fixed export functionality
- Resolved save button issues

### Improvements
- Better error handling
- UI/UX enhancements
```

## 🎯 Best Practices

1. **Always test updates** before publishing
2. **Use semantic versioning** consistently
3. **Write clear release notes** for users
4. **Keep backwards compatibility** when possible
5. **Test auto-updater** with different scenarios
6. **Monitor user feedback** after releases

## 🔐 Security Notes

- Keep your GitHub token secure
- Sign your releases for Windows
- Test updates in isolated environments
- Never publish debug builds to production

---

*This guide ensures smooth updates for Excel Grade Entry users! 🎉*
