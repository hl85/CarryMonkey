import React, { useState, useEffect, useCallback } from 'react'
import { Layout, Menu, Table, Switch, Input, Button, Space, message, Modal } from 'antd'
import { PlusOutlined, FileTextOutlined, DeleteOutlined } from '@ant-design/icons'
import { getScripts, saveScript, deleteScripts, updateScript } from '../../core/storage'
import type { UserScript, Grant } from '../../core/types'

const { Header, Sider, Content } = Layout

const getNewScriptTemplate = () => {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const version = `${year}.${month}.${day}`

  return `// ==UserScript==
// @name         New Userscript
// @namespace    http://carrymonkey.net/
// @version      ${version}
// @description  try to take over the world!
// @author       You
// @match        https://*/*
// @icon         data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Your code here...
})();`
}

const parseUserScriptMeta = (content: string): UserScript['meta'] => {
  const meta: UserScript['meta'] = {
    name: '',
    namespace: '',
    version: '',
    description: '',
    author: '',
    match: [],
    icon: '',
    grant: [],
    copyright: '',
    license: '',
    source: '',
    supportURL: '',
    require: [],
    compatible: [],
    connect: [],
    resource: {},
    downloadURL: '',
    updateURL: '',
    'run-at': 'document-end',
  };

  // Use matchAll with a global regex to find all metadata tags, regardless of newlines.
  const matches = content.matchAll(/\/\/\s*@(\S+)\s+(.*)/g);

  for (const match of matches) {
    const key = match[1];
    const value = match[2].trim();
    
    switch (key) {
      case 'name':
        meta.name = value;
        break;
      case 'version':
        meta.version = value;
        break;
      case 'description':
        meta.description = value;
        break;
      case 'author':
        meta.author = value;
        break;
      case 'match':
        meta.match.push(value);
        break;
      case 'icon':
        meta.icon = value;
        break;
      case 'grant':
        meta.grant.push(value as Grant);
        break;
    }
  }
  return meta;
};

const App: React.FC = () => {
  const [activeView, setActiveView] = useState('scriptList')
  const [selectedMenuKey, setSelectedMenuKey] = useState('scriptList')
  const [scriptContent, setScriptContent] = useState(getNewScriptTemplate())
  const [scripts, setScripts] = useState<UserScript[]>([])
  const [editingScript, setEditingScript] = useState<UserScript | null>(null)
  const [selectedScriptIds, setSelectedScriptIds] = useState<string[]>([])
  const [messageApi, contextHolder] = message.useMessage()
  const [version, setVersion] = useState('')

  useEffect(() => {
    const fetchScripts = async () => {
      const scriptsFromStorage = await getScripts();
      setScripts(scriptsFromStorage);
    };

    fetchScripts();
    // 用 setTimeout 包装，转为异步执行，避免同步级联渲染
    setTimeout(() => {
      setVersion(chrome.runtime.getManifest().version);
    }, 0);
  }, []);

  const handleSave = useCallback(async () => {
    const meta = parseUserScriptMeta(scriptContent);

    if (!meta.name) {
      messageApi.error('脚本名称 (@name) 不能为空');
      return;
    }

    if (editingScript) {
      // Update existing script
      const updatedScript = { ...editingScript, content: scriptContent, meta, lastUpdated: Date.now() };
      await updateScript(updatedScript);
      messageApi.success('更新成功');
    } else {
      // Create new script
      const newScript: UserScript = {
        id: crypto.randomUUID(),
        content: scriptContent,
        enabled: true,
        meta,
        lastUpdated: Date.now(),
      };
      await saveScript(newScript);
      messageApi.success('保存成功');
    }

    getScripts().then(setScripts);
    setEditingScript(null);
    setScriptContent(getNewScriptTemplate());
    setActiveView('scriptList');
    setSelectedMenuKey('scriptList');
  }, [editingScript, scriptContent, messageApi]);

  const handleNewScript = useCallback(() => {
    setEditingScript(null);
    setScriptContent(getNewScriptTemplate());
    setActiveView('newScript');
    setSelectedMenuKey('newScript');
  }, []);

  // 键盘快捷键处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

      // Ctrl/Cmd + S: 保存脚本
      if (cmdOrCtrl && event.key === 's') {
        event.preventDefault();
        if (activeView === 'newScript' || activeView === 'editScript') {
          handleSave();
        }
        return;
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeView, handleSave]);

  const handleEdit = (script: UserScript) => {
    setEditingScript(script);
    setScriptContent(script.content);
    setActiveView('editScript');
    setSelectedMenuKey('editScript');
  };

  const handleDelete = (scriptId: string) => {
    Modal.confirm({
      title: '确认删除',
      content: '您确定要删除这个脚本吗？此操作不可撤销。',
      onOk: async () => {
        await deleteScripts([scriptId]);
        getScripts().then(setScripts);
        messageApi.success('删除成功');
      },
    });
  };

  const handleBatchDelete = () => {
    Modal.confirm({
      title: '确认删除',
      content: `您确定要删除选中的 ${selectedScriptIds.length} 个脚本吗？此操作不可撤销。`,
      onOk: async () => {
        await deleteScripts(selectedScriptIds);
        getScripts().then(setScripts);
        setSelectedScriptIds([]);
        messageApi.success('批量删除成功');
      },
    });
  };

  const handleToggleEnabled = async (script: UserScript, checked: boolean) => {
    const updatedScript = { ...script, enabled: checked };
    await updateScript(updatedScript);

    setScripts(prevScripts =>
      prevScripts.map(s => (s.id === script.id ? updatedScript : s))
    );

    messageApi.success(checked ? '脚本已启用' : '脚本已禁用');
  };

  const columns = [
    {
      title: '状态',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (_: boolean, record: UserScript) => (
        <Switch checked={record.enabled} onChange={(checked) => handleToggleEnabled(record, checked)} />
      ),
      sorter: (a: UserScript, b: UserScript) => Number(a.enabled) - Number(b.enabled),
    },
    {
      title: '脚本名称',
      dataIndex: ['meta', 'name'],
      key: 'name',
      sorter: (a: UserScript, b: UserScript) => a.meta.name.localeCompare(b.meta.name),
    },
    {
      title: '版本',
      dataIndex: ['meta', 'version'],
      key: 'version',
    },
    {
      title: '大小',
      dataIndex: 'content',
      key: 'size',
      render: (content: string) => `${(content.length / 1024).toFixed(2)} KB`,
    },
    {
      title: '站点',
      dataIndex: ['meta', 'match'],
      key: 'match',
      render: (match: string[]) => match.join(', '),
    },
    {
      title: '最后更新',
      dataIndex: 'lastUpdated',
      key: 'lastUpdated',
      render: (timestamp: number) => new Date(timestamp).toLocaleString(),
      sorter: (a: UserScript, b: UserScript) => a.lastUpdated - b.lastUpdated,
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: UserScript) => (
        <Space size="middle">
          <Button type="link" onClick={() => handleEdit(record)}>编辑</Button>
          <Button type="link" danger onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ]

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {contextHolder}
      <Header style={{ padding: '0 16px', background: '#20232a', color: 'white', display: 'flex', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '20px', color: 'white' }}>
          <span style={{ marginRight: '10px' }}>🐵</span>
          Carry Monkey
          <span style={{ marginLeft: '10px', fontSize: '14px', color: '#aaa' }}>v{version}</span>
        </h1>
      </Header>
      <Content style={{ paddingTop: '16px' }}>
        <Layout className="site-layout-background" style={{ padding: '24px 0', minHeight: 'calc(100vh - 64px - 16px)' }}>
          <Sider className="site-layout-background" width={200}>
            <Menu
              mode="inline"
              selectedKeys={[selectedMenuKey]}
              style={{ height: '100%' }}
              onSelect={({ key }) => {
                if (key === 'newScript') {
                  handleNewScript();
                } else {
                  setActiveView(key);
                  setSelectedMenuKey(key);
                }
              }}
            >
              <Menu.Item key="newScript" icon={<PlusOutlined />}>
                新建脚本
              </Menu.Item>
              <Menu.Item key="scriptList" icon={<FileTextOutlined />}>
                脚本管理
              </Menu.Item>
            </Menu>
          </Sider>
          <Content style={{ padding: '0 24px', minHeight: 280 }}>
            {activeView === 'scriptList' ? (
                <>
                  <Button
                    type="primary"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={handleBatchDelete}
                    disabled={selectedScriptIds.length === 0}
                    style={{ marginBottom: 16 }}
                  >
                    删除选中
                  </Button>
                  <Table
                    columns={columns}
                    dataSource={scripts}
                    rowKey="id"
                    rowSelection={{
                      selectedRowKeys: selectedScriptIds,
                      onChange: (keys) => setSelectedScriptIds(keys as string[]),
                    }}
                  />
                </>
              ) : (
                <>
                  <Space style={{ marginBottom: 16 }}>
                    <Button type="primary" onClick={handleSave}>
                      保存 <span style={{ opacity: 0.7, fontSize: '12px' }}>({navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl'}+S)</span>
                    </Button>
                    <Button onClick={() => {
                      setActiveView('scriptList');
                      setSelectedMenuKey('scriptList');
                      setEditingScript(null);
                      setScriptContent(getNewScriptTemplate());
                    }}>取消</Button>
                  </Space>
                  <Input.TextArea
                    style={{ height: 'calc(100vh - 204px)', fontFamily: 'monospace' }}
                    value={scriptContent}
                    onChange={(e) => setScriptContent(e.target.value)}
                  />
                </>
              )}
          </Content>
        </Layout>
      </Content>
    </Layout>
  )
}

export default App
