# How to Publish Cloudable to npm

## ✅ Ready to Publish!

Your package is configured and ready. Follow these steps:

###  1: Login to npm (One Time Only)

```bash
npm login
```

Enter your npm credentials:
- Username
- Password  
- Email

### 2: Publish

```bash
cd "/Users/bikashpokharel/Desktop/untitled folder/cloudable"
npm publish --access public
```

That's it! In 10 seconds it's live.

## 🎉 After Publishing

Your friend can install it:

```bash
npm install -g cloudable-cli
```

Then use it anywhere:

```bash
cd /path/to/any/project
cloudable recommend
cloudable recommend --all
cloudable analyze
```

## 🔄 How to Update Later

When you add new features:

```bash
# 1. Make your changes to the code

# 2. Build (if you changed source files)
npm run build

# 3. Bump the version
npm version patch    # 1.0.0 -> 1.0.1 (bug fixes)
# OR
npm version minor    # 1.0.0 -> 1.1.0 (new features)
# OR  
npm version major    # 1.0.0 -> 2.0.0 (breaking changes)

# 4. Publish the update
npm publish
```

Users get updates with:

```bash
npm update -g cloudable-cli
```

## 📦 Your Package

- Name: `cloudable-cli`
- URL: https://www.npmjs.com/package/cloudable-cli (after publishing)
- Install: `npm install -g cloudable-cli`

## 🚀 Quick Publish Now

```bash
npm login
npm publish --access public
```

Done! ✅

