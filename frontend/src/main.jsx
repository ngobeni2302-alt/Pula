import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../teacher/style.css';
import { CoreProvider } from './core/CoreContext.jsx';
import './core/core.css';
import RoleEntry from './RoleEntry.jsx';

createRoot(document.getElementById('root')).render(<CoreProvider><RoleEntry /></CoreProvider>);
