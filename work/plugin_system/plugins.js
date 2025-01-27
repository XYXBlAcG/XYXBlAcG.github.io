const plugins = JSON.parse(localStorage.getItem('plugins')) || [];
const selectedPlugins = JSON.parse(localStorage.getItem('selectedPlugins')) || [];

document.addEventListener('DOMContentLoaded', () => {
    loadPlugins();
    runSelectedPlugins();
});

function showSidebar() {
    document.getElementById('pluginSidebar').classList.add('show');
}

function hideSidebar() {
    document.getElementById('pluginSidebar').classList.remove('show');
}

function loadPlugins() {
    const pluginFrame = document.getElementById('pluginFrame').contentWindow.document;
    pluginFrame.open();
    pluginFrame.write('<html><body></body></html>');
    pluginFrame.close();
    const body = pluginFrame.body;
    plugins.forEach((plugin, index) => {
        const pluginDiv = document.createElement('div');
        pluginDiv.className = 'plugin';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = selectedPlugins.includes(index);
        checkbox.onchange = () => togglePlugin(index);
        pluginDiv.appendChild(checkbox);
        const label = document.createElement('label');
        label.textContent = plugin.title;
        pluginDiv.appendChild(label);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = '删除';
        deleteButton.onclick = () => deletePlugin(index);
        pluginDiv.appendChild(deleteButton);
        body.appendChild(pluginDiv);
    });
}

function runSelectedPlugins() {
    selectedPlugins.forEach(index => {
        try {
            eval(plugins[index].code);
        } catch (e) {
            console.error('Error running plugin:', e);
        }
    });
}

function togglePlugin(index) {
    const pos = selectedPlugins.indexOf(index);
    if (pos > -1) {
        selectedPlugins.splice(pos, 1);
    } else {
        selectedPlugins.push(index);
    }
}

function saveAndRefresh() {
    localStorage.setItem('selectedPlugins', JSON.stringify(selectedPlugins));
    location.reload();
}

function exportPlugins() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(plugins));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "plugins.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function importPlugins(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const importedPlugins = JSON.parse(e.target.result);
            plugins.push(...importedPlugins);
            localStorage.setItem('plugins', JSON.stringify(plugins));
            location.reload();
        };
        reader.readAsText(file);
    }
}

function showAddPluginForm() {
    document.getElementById('addPluginForm').style.display = 'block';
}

function hideAddPluginForm() {
    document.getElementById('addPluginForm').style.display = 'none';
}

function addPlugin() {
    const title = document.getElementById('pluginTitle').value;
    const code = document.getElementById('pluginCode').value;
    if (title && code) {
        plugins.push({ title, code });
        localStorage.setItem('plugins', JSON.stringify(plugins));
        location.reload();
    } else {
        alert(" Failed to add plugin. Please provide a title and code.");
    }
}

function deletePlugin(index) {
    plugins.splice(index, 1);
    localStorage.setItem('plugins', JSON.stringify(plugins));
    location.reload();
}
