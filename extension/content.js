(() => {
  console.log('[Claude Web Tweaks] content script loaded');
  const STORAGE_KEY = 'cwt.sidebarWidth';
  const MIN_WIDTH = 200;
  const MAX_WIDTH = 600;
  const DEFAULT_WIDTH = 288;

  const getSavedWidth = () => {
    const v = parseInt(localStorage.getItem(STORAGE_KEY), 10);
    return Number.isFinite(v) ? clamp(v) : DEFAULT_WIDTH;
  };

  const clamp = (w) => Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w));

  const findSidebar = () => {
    const nav = document.querySelector('nav.flex.flex-col');
    if (!nav) return null;
    const sticky = nav.parentElement;
    const shrink = sticky?.parentElement;
    if (!sticky || !shrink || !shrink.classList.contains('shrink-0')) return null;
    return { nav, sticky, shrink };
  };

  const applyWidth = (parts, width) => {
    const px = `${width}px`;
    parts.nav.style.width = px;
    parts.sticky.style.width = px;
    parts.shrink.style.width = px;
  };

  const installHandle = (parts) => {
    if (parts.nav.querySelector(':scope > .cwt-resize-handle')) return;

    const handle = document.createElement('div');
    handle.className = 'cwt-resize-handle';
    handle.title = 'Drag to resize sidebar (double-click to reset)';

    parts.nav.appendChild(handle);
    console.log('[Claude Web Tweaks] resize handle installed on sidebar');

    let startX = 0;
    let startWidth = 0;

    const onMove = (e) => {
      const next = clamp(startWidth + (e.clientX - startX));
      applyWidth(parts, next);
    };

    const onUp = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.body.classList.remove('cwt-resizing');
      handle.classList.remove('cwt-dragging');
      const finalWidth = parts.nav.getBoundingClientRect().width;
      localStorage.setItem(STORAGE_KEY, String(Math.round(finalWidth)));
    };

    handle.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      startX = e.clientX;
      startWidth = parts.nav.getBoundingClientRect().width;
      document.body.classList.add('cwt-resizing');
      handle.classList.add('cwt-dragging');
      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    });

    handle.addEventListener('dblclick', () => {
      applyWidth(parts, DEFAULT_WIDTH);
      localStorage.setItem(STORAGE_KEY, String(DEFAULT_WIDTH));
    });
  };

  let lastNav = null;
  const sync = () => {
    const parts = findSidebar();
    if (!parts) return;
    const remounted = parts.nav !== lastNav;
    const missingHandle = !parts.nav.querySelector(':scope > .cwt-resize-handle');
    if (remounted || missingHandle) {
      applyWidth(parts, getSavedWidth());
      installHandle(parts);
      lastNav = parts.nav;
    }
    tagSidebarChats();
  };

  const CHIP_CLASS = 'cwt-project-chip';
  let chatsByUuid = null;

  const HUES_KEY = 'cwt.projectHues';

  const loadProjectHues = () => {
    try {
      const raw = localStorage.getItem(HUES_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const projectHues = loadProjectHues();

  // Circular distance between two hues, 0..180.
  const hueGap = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

  // Returns a stable hue for a project: random on first sight, then persisted.
  const projectHue = (uuid) => {
    if (typeof projectHues[uuid] === 'number') return projectHues[uuid];

    const used = Object.values(projectHues);
    let hue = Math.floor(Math.random() * 360);
    // Try a few times to keep new colours visually distinct from existing ones.
    for (let i = 0; i < 16 && used.some((h) => hueGap(hue, h) < 25); i++) {
      hue = Math.floor(Math.random() * 360);
    }

    projectHues[uuid] = hue;
    try {
      localStorage.setItem(HUES_KEY, JSON.stringify(projectHues));
    } catch {}
    return hue;
  };

  const tagSidebarChats = () => {
    if (!chatsByUuid) return;
    const links = document.querySelectorAll('nav a[data-dd-action-name="sidebar-chat-item"]');
    for (const link of links) {
      const m = link.getAttribute('href')?.match(/\/chat\/([0-9a-f-]+)/);
      const chat = m ? chatsByUuid.get(m[1]) : null;
      const inner = link.querySelector('div.flex');
      if (!inner) continue;
      const existing = inner.querySelector(':scope > .' + CHIP_CLASS);
      const projectUuid = chat?.project?.uuid || null;

      if (!projectUuid) {
        if (existing) existing.remove();
        continue;
      }
      if (existing && existing.dataset.projectUuid === projectUuid) continue;
      if (existing) existing.remove();

      const chip = document.createElement('span');
      chip.className = CHIP_CLASS;
      chip.dataset.projectUuid = projectUuid;
      chip.title = `Project: ${chat.project.name}`;
      chip.textContent = chat.project.name;
      chip.style.setProperty('--cwt-hue', String(projectHue(projectUuid)));
      inner.appendChild(chip);
    }
  };

  let pending = false;
  const scheduleSync = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(() => {
      pending = false;
      sync();
    });
  };

  sync();
  new MutationObserver(scheduleSync).observe(document.body, { childList: true, subtree: true });

  const dumpAllChats = async () => {
    console.log('[Claude Web Tweaks] fetching all chats...');
    const orgsRes = await fetch('/api/organizations', { credentials: 'include' });
    const orgs = await orgsRes.json();
    const chatOrg = orgs.find(o => o.capabilities?.includes('chat')) || orgs[0];
    if (!chatOrg) {
      console.warn('[Claude Web Tweaks] no chat-capable organization found');
      return;
    }
    console.log(`[Claude Web Tweaks] using org: ${chatOrg.name} (${chatOrg.uuid})`);

    const PAGE = 100;
    const all = [];
    for (let offset = 0; ; offset += PAGE) {
      const url = `/api/organizations/${chatOrg.uuid}/chat_conversations?limit=${PAGE}&offset=${offset}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        console.error(`[Claude Web Tweaks] fetch failed at offset ${offset}: ${res.status}`);
        break;
      }
      const page = await res.json();
      all.push(...page);
      if (page.length < PAGE) break;
    }

    const grouped = new Map();
    for (const c of all) {
      const key = c.project_uuid || '__no_project__';
      if (!grouped.has(key)) {
        grouped.set(key, {
          projectName: c.project?.name || '(no project)',
          projectUuid: c.project_uuid || null,
          chats: []
        });
      }
      grouped.get(key).chats.push(c);
    }

    console.log(`[Claude Web Tweaks] found ${all.length} chat${all.length === 1 ? '' : 's'} across ${grouped.size} group${grouped.size === 1 ? '' : 's'}`);

    const ordered = [...grouped.values()].sort((a, b) => {
      if (!a.projectUuid) return 1;
      if (!b.projectUuid) return -1;
      return a.projectName.localeCompare(b.projectName);
    });

    for (const group of ordered) {
      const label = group.projectUuid
        ? `Project: ${group.projectName}  [${group.projectUuid}]  — ${group.chats.length} chat${group.chats.length === 1 ? '' : 's'}`
        : `(No project)  — ${group.chats.length} chat${group.chats.length === 1 ? '' : 's'}`;
      console.groupCollapsed(label);
      const sorted = group.chats.slice().sort((a, b) => (b.updated_at || '').localeCompare(a.updated_at || ''));
      for (const c of sorted) {
        console.groupCollapsed(`${c.is_starred ? '★ ' : ''}${c.name || '(untitled)'}  —  ${c.updated_at}`);
        console.log({
          uuid: c.uuid,
          name: c.name,
          summary: c.summary,
          model: c.model,
          created_at: c.created_at,
          updated_at: c.updated_at,
          is_starred: c.is_starred,
          is_temporary: c.is_temporary,
          platform: c.platform,
          session_id: c.session_id,
          current_leaf_message_uuid: c.current_leaf_message_uuid,
          user_uuid: c.user_uuid,
          project_uuid: c.project_uuid,
          project: c.project,
          settings: c.settings,
          url: `https://claude.ai/chat/${c.uuid}`
        });
        console.groupEnd();
      }
      console.groupEnd();
    }

    console.table(all.map(c => ({
      name: c.name,
      project: c.project?.name || '',
      model: c.model,
      starred: c.is_starred,
      updated_at: c.updated_at,
      uuid: c.uuid
    })));

    window.cwtChats = all;
    chatsByUuid = new Map(all.map(c => [c.uuid, c]));
    window.cwtChatsByUuid = chatsByUuid;
    tagSidebarChats();
    console.log('[Claude Web Tweaks] full list saved to window.cwtChats; sidebar chips applied');
  };

  window.cwtDumpChats = dumpAllChats;
  dumpAllChats().catch(e => console.error('[Claude Web Tweaks] dump failed:', e));
})();
