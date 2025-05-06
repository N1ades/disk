const buildTree = (data) => {
    const root = {};
    data.forEach(item => {
        const parts = item.path.split('/').filter(Boolean);
        let node = root;
        parts.forEach((part, idx) => {
            if (!node[part]) node[part] = { __meta: null, __children: {} };
            if (idx === parts.length - 1) node[part].__meta = item;
            node = node[part].__children;
        });
    });
    return root;
};

const humanSize = (bytes) => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
        bytes /= 1024;
        i++;
    }
    return bytes.toFixed(1) + ' ' + units[i];
};

const toggles = new Map();
let lineCount = 0;
const MAX_LINES = 1000;
let reachedLimit = false;

const renderNode = (node, path = '', depth = 0) => {
    if (reachedLimit) return null;

    const ul = document.createElement('ul');
    ul.className = 'tree';

    for (const [key, { __meta, __children }] of Object.entries(node)) {
        if (reachedLimit) break;

        lineCount++;
        if (lineCount > MAX_LINES) {
            reachedLimit = true;
            break;
        }

        const li = document.createElement('li');
        const container = document.createElement('div');
        container.style.paddingLeft = `${depth * 20}px`;

        const currentPath = path ? `${path}/${key}` : key;

        if (!__meta || __meta.info.type === 'folder') {
            container.className = 'folder';

            const toggle = document.createElement('span');
            toggle.className = 'toggle';
            toggle.textContent = toggles.get(currentPath) ? '-' : '+';
            container.append(toggle);

            const name = document.createElement('span');
            name.textContent = key;
            name.className = 'name';
            container.append(name);

            const metaCountSpan = document.createElement('span');
            metaCountSpan.textContent = calculateFolderCount({ [key]: { __meta, __children } }) + ' files';
            metaCountSpan.className = 'count';
            container.append(metaCountSpan);

            const metaSpan = document.createElement('span');
            metaSpan.textContent = humanSize(calculateFolderSize({ [key]: { __meta, __children } }));
            metaSpan.className = 'meta';
            container.append(metaSpan);

            const actions = document.createElement('span');
            actions.className = 'actions';
            actions.innerHTML = '<button>X</button><button>Copy link</button>';
            container.append(actions);

            li.append(container);

            const childrenUl = renderNode(__children, currentPath, depth + 1);
            if (childrenUl) {
                childrenUl.style.display = toggles.get(currentPath) ? 'block' : 'none';
                li.append(childrenUl);
            }

            const toggleAll = () => {
                const isHidden = childrenUl && childrenUl.style.display === 'none';
                if (childrenUl) {
                    childrenUl.style.display = isHidden ? 'block' : 'none';
                    toggle.textContent = isHidden ? '-' : '+';
                }
                toggles.set(currentPath, isHidden);
            };
            name.addEventListener('click', toggleAll);
            toggle.addEventListener('click', toggleAll);
        } else {
            container.className = 'file';

            const name = document.createElement('span');
            name.textContent = key;
            name.className = 'name';
            container.append(name);

            const metaSpan = document.createElement('span');
            metaSpan.textContent = humanSize(__meta.info.size);
            metaSpan.className = 'meta';
            container.append(metaSpan);

            const actions = document.createElement('span');
            actions.className = 'actions';
            actions.innerHTML = '<button>X</button><button>Copy link</button>';
            container.append(actions);

            li.append(container);
        }

        ul.append(li);
    }

    return ul;
};

const calculateFolderSize = (node) => {
    let total = 0;
    for (const { __meta, __children } of Object.values(node)) {
        if (__meta?.info?.size) total += __meta.info.size;
        total += calculateFolderSize(__children);
    }
    return total;
};

const calculateFolderCount = (node) => {
    let total = 0;
    for (const { __meta, __children } of Object.values(node)) {
        if (__meta?.info?.size) total += 1;
        total += calculateFolderCount(__children);
    }
    return total;
};

export const renderTree = (element, items) => {
    const treeData = buildTree(items);
    lineCount = 0;
    reachedLimit = false;

    const tree = renderNode(treeData);
    const container = document.createElement('div');
    container.id = 'fileTree';
    if (tree) container.append(tree);

    if (reachedLimit) {
        const notice = document.createElement('div');
        notice.className = 'limit-notice';
        notice.style.marginTop = '10px';
        notice.style.fontStyle = 'italic';
        notice.textContent = 'More items available, download full folder to view all.';
        container.append(notice);
    }

    element.replaceWith(container);
};
