# CarryMonkey

CarryMonkey is a powerful browser extension that allows you to manage and inject custom user scripts into web pages. It is designed to be a modern, lightweight, and secure alternative to other script managers.

## ✨ Features

- **Script Management**: Easily create, edit, and manage your user scripts.
- **Automatic Injection**: Scripts are automatically injected into pages that match their defined patterns.
- **Content Security Policy (CSP) Handling**: Advanced nonce detection to bypass strict CSP rules.
- **Modern UI**: A clean and intuitive user interface built with React and TypeScript.
- **Secure**: Uses Trusted Types to prevent DOM XSS attacks.
- **Lightweight**: Built with Vite for a fast and efficient development experience.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (recommended)
    ```bash
    brew install node
    brew install pnpm
    ```

### Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/your-username/carrymonkey.git
    cd carrymonkey
    ```

2.  **Install dependencies:**
    ```bash
    pnpm install
    ```

3.  **Build the extension:**
    ```bash
    pnpm build
    ```

### Loading the Extension

1.  Open Google Chrome and navigate to `chrome://extensions`.
2.  Enable **Developer mode** in the top right corner.
3.  Click **Load unpacked**.
4.  Select the `dist` folder in the project directory.

## 🛠️ Development

To start the development server with hot-reloading, run:

```bash
pnpm dev
```

This will watch for changes and automatically rebuild the extension. You will need to manually reload the extension in `chrome://extensions` to see the changes.

## 📦 Building for Production

To build the extension for production, run:

```bash
pnpm build
```

This will create an optimized build in the `dist` folder, ready to be packed and published.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a pull request or open an issue to discuss any changes.

## 📄 License

This project is licensed under the MIT License.
