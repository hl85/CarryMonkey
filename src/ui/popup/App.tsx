import React, { useState, useEffect } from 'react';
import { Menu } from 'antd';
import { SettingOutlined, FileTextOutlined } from '@ant-design/icons';
import { getScripts } from '../../core/storage';
import type { UserScript } from '../../core/types';
import type { MenuProps } from 'antd';

const App: React.FC = () => {
  const [matchedScripts, setMatchedScripts] = useState<UserScript[]>([]);
  const [tabId, setTabId] = useState<number | undefined>(undefined);

  useEffect(() => {
    const loadMatchedScripts = async () => {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      setTabId(tab.id);
      if (tab.url) {
        const allScripts = await getScripts();
        // We only show enabled scripts in the popup.
        const matched = allScripts.filter((script: UserScript) =>
          script.enabled &&
          script.meta.match.some((pattern: string) => new RegExp(pattern.replace(/\*/g, '.*')).test(tab.url!))
        );
        setMatchedScripts(matched);
      }
    };
    loadMatchedScripts();
  }, []);

  const handleMenuClick: MenuProps['onClick'] = ({ key }) => {
    if (key === 'dashboard') {
      chrome.runtime.openOptionsPage();
    } else {
      const scriptToExecute = matchedScripts.find(s => s.id === key);
      if (scriptToExecute && tabId) {
        chrome.runtime.sendMessage({
          action: 'executeScript',
          script: scriptToExecute,
          tabId: tabId,
        });
        window.close();
      }
    }
  };

  const menuItems: MenuProps['items'] = matchedScripts.map(script => ({
    key: script.id,
    icon: script.meta.icon ? 
          <img src={script.meta.icon} alt={script.meta.name} style={{ width: 16, height: 16 }} /> : 
          <FileTextOutlined />,
    label: script.meta.name, // Revert to simple string label
  }));

  if (matchedScripts.length > 0) {
    menuItems.push({ type: 'divider' });
  }

  menuItems.push({
    key: 'dashboard',
    icon: <SettingOutlined />,
    label: '管理面板',
  });

  return (
    <div style={{ width: 220 }}>
      <Menu onClick={handleMenuClick} items={menuItems} />
    </div>
  );
};

export default App;
