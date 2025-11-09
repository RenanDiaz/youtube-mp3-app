# VS Code Configuration

This directory contains VS Code workspace configurations for the YouTube MP3 Converter project.

## 🚀 Quick Start

### Running the Full Stack Application

1. **Press `F5`** or go to **Run and Debug** (Ctrl+Shift+D / Cmd+Shift+D)
2. Select **"Full Stack: Frontend + Backend"** from the dropdown
3. Click the green play button

This will start both the backend server and frontend dev server simultaneously.

## 📋 Available Launch Configurations

### Development Configurations

- **Full Stack: Frontend + Backend** ⭐ (Recommended)
  - Runs both frontend and backend together
  - Backend on http://localhost:5001
  - Frontend on http://localhost:3000
  - Automatically opens browser when ready

- **Full Stack: Frontend + Backend (Debug)**
  - Same as above but with debug mode enabled for backend
  - Allows setting breakpoints in backend code

### Individual Configurations

- **Frontend: Vite Dev Server**
  - Runs only the frontend development server
  - Hot Module Replacement (HMR) enabled
  - Opens browser automatically

- **Backend: Node Server**
  - Runs only the backend server
  - Normal mode without debug output

- **Backend: Node Server (Debug Mode)**
  - Runs backend with debugging enabled
  - Allows setting breakpoints
  - Shows detailed debug output

### Testing Configurations

- **Frontend: Run Tests**
  - Runs Vitest tests once

- **Frontend: Run Tests (UI)**
  - Opens Vitest UI for interactive testing
  - Great for TDD workflow

### Build Configurations

- **Frontend: Build Production**
  - Creates production build in `frontend/build/`

- **Frontend: Preview Production Build**
  - Previews the production build locally
  - Tests production bundle before deployment

## 🛠️ Available Tasks

Access tasks via **Terminal > Run Task...** or `Cmd+Shift+P` > "Tasks: Run Task"

### Installation Tasks
- **Install All Dependencies** - Install both frontend and backend dependencies
- **Frontend: Install Dependencies** - Install only frontend dependencies
- **Backend: Install Dependencies** - Install only backend dependencies

### Development Tasks
- **Start Full Stack** - Start both servers (alternative to launch config)
- **Frontend: Start Dev Server** - Start only frontend
- **Backend: Start Server** - Start only backend

### Testing Tasks
- **Frontend: Run Tests** - Run tests once
- **Frontend: Run Tests (Watch)** - Run tests in watch mode

### Build Tasks
- **Frontend: Build Production** - Create production build
- **Frontend: Type Check** - Run TypeScript type checking

### Utility Tasks
- **Git: Status** - Show git status

## ⚙️ Settings

The workspace is configured with:

- **Auto-formatting on save** using Prettier
- **Import organization** on save
- **TypeScript IntelliSense** for both frontend and backend
- **ESLint integration** (if ESLint is configured)
- **Consistent formatting** across all file types

## 🔌 Recommended Extensions

When you open this workspace, VS Code will prompt you to install recommended extensions:

### Essential
- **ESLint** - Linting for JavaScript/TypeScript
- **Prettier** - Code formatter

### TypeScript & React
- **ES7+ React/Redux/React-Native snippets** - Code snippets
- **vscode-styled-components** - Syntax highlighting for styled-components

### Testing
- **Vitest** - Test explorer integration

### Git
- **GitLens** - Enhanced Git capabilities
- **Git Graph** - Visualize git history

### Utilities
- **Path Intellisense** - Autocomplete file paths
- **Auto Rename Tag** - Automatically rename paired HTML/JSX tags
- **npm Intellisense** - Autocomplete npm modules
- **Error Lens** - Show errors inline
- **Code Spell Checker** - Spell checking

## 🎯 Debugging

### Setting Breakpoints

1. Open a file (e.g., `backend/index.js`)
2. Click in the gutter to the left of the line number to set a breakpoint
3. Start the debug configuration
4. The debugger will pause when the breakpoint is hit

### Debug Console

Use the Debug Console to:
- Evaluate expressions
- Inspect variables
- Execute code in the current context

### Debugging Frontend

For frontend debugging:
1. Install the **Chrome DevTools** or **Firefox DevTools** extension
2. Use browser DevTools for React component debugging
3. Use VS Code breakpoints for business logic

## 📝 Customization

### Adding New Launch Configurations

Edit `.vscode/launch.json` to add new configurations. Example:

```json
{
  "name": "My Custom Task",
  "type": "node",
  "request": "launch",
  "cwd": "${workspaceFolder}/backend",
  "program": "${workspaceFolder}/backend/my-script.js"
}
```

### Adding New Tasks

Edit `.vscode/tasks.json` to add new tasks. Example:

```json
{
  "label": "My Custom Task",
  "type": "shell",
  "command": "echo Hello World",
  "problemMatcher": []
}
```

## 🔍 Tips

- Use **Cmd+P** (Mac) / **Ctrl+P** (Windows/Linux) for quick file navigation
- Use **Cmd+Shift+P** / **Ctrl+Shift+P** for command palette
- Use **Cmd+`** / **Ctrl+`** to toggle terminal
- Use **F5** to start debugging
- Use **Shift+F5** to stop debugging
- Use **Cmd+Shift+F** / **Ctrl+Shift+F** for global search

## 🐛 Troubleshooting

### Port Already in Use

If you see "Port 3000/5001 already in use":
1. Stop any running instances of the app
2. Check for processes using the port: `lsof -i :3000` or `lsof -i :5001`
3. Kill the process: `kill -9 <PID>`

### Dependencies Not Found

If you see "Cannot find module" errors:
1. Run the "Install All Dependencies" task
2. Or manually: `cd frontend && npm install` and `cd backend && npm install`

### TypeScript Errors

If you see TypeScript errors:
1. Run "Frontend: Type Check" task to see all errors
2. Make sure TypeScript version matches: Check `frontend/package.json`
3. Reload VS Code: Cmd+Shift+P > "Developer: Reload Window"

## 📚 Resources

- [VS Code Debugging Guide](https://code.visualstudio.com/docs/editor/debugging)
- [VS Code Tasks Documentation](https://code.visualstudio.com/docs/editor/tasks)
- [Vite Documentation](https://vitejs.dev/)
- [Node.js Debugging Guide](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)
