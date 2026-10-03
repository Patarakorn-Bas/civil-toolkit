/**
 * Civil Toolkit – เซิร์ฟเวอร์ซิงก์ข้อมูล (Google Apps Script)
 * เก็บข้อมูลโครงการเป็นไฟล์ JSON ใน Google Drive ของคุณเอง
 * วิธีใช้: เปลี่ยน SECRET ด้านล่างเป็นรหัสของคุณเอง แล้ว Deploy เป็น Web app
 *         (Execute as: Me, Who has access: Anyone)
 */
var SECRET = 'CHANGE-ME-ตั้งรหัสของคุณเอง';
var FOLDER_NAME = 'Civil Toolkit Sync';
var FILE_NAME = 'civil-toolkit-data.json';
var KEEP_BACKUPS = 20;

function doGet(e) { return handle_((e && e.parameter) || {}); }
function doPost(e) {
  var body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: 'bad-json' }); }
  return handle_(body);
}

function handle_(p) {
  if (SECRET.indexOf('CHANGE-ME') === 0) return out_({ ok: false, error: 'secret-not-set' });
  if (p.key !== SECRET) return out_({ ok: false, error: 'unauthorized' });
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var f = file_(), raw = f.getBlob().getDataAsString(), cur = {};
    try { cur = raw ? JSON.parse(raw) : {}; } catch (err) { cur = {}; }
    var updated = cur.updated || 0;
    if (p.action === 'ping') return out_({ ok: true, updated: updated, device: cur.device || '' });
    if (p.action === 'get') return out_({ ok: true, updated: updated, device: cur.device || '', data: cur.data || null });
    if (p.action === 'put') {
      var base = Number(p.base) || 0;
      if (updated && updated !== base && !p.force) return out_({ ok: false, conflict: true, updated: updated, device: cur.device || '' });
      if (raw) backup_(f.getParents().next(), raw);
      var now = Date.now();
      f.setContent(JSON.stringify({ updated: now, device: p.device || '', data: p.data }));
      return out_({ ok: true, updated: now });
    }
    return out_({ ok: false, error: 'unknown-action' });
  } finally { lock.releaseLock(); }
}

function folder_() {
  var it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}
function file_() {
  var props = PropertiesService.getScriptProperties(), id = props.getProperty('FILE_ID');
  if (id) { try { return DriveApp.getFileById(id); } catch (err) { /* recreate */ } }
  var fo = folder_(), it = fo.getFilesByName(FILE_NAME), f = it.hasNext() ? it.next() : fo.createFile(FILE_NAME, '', 'application/json');
  props.setProperty('FILE_ID', f.getId());
  return f;
}
function backup_(fo, raw) {
  var bi = fo.getFoldersByName('backups'), bf = bi.hasNext() ? bi.next() : fo.createFolder('backups');
  bf.createFile('backup-' + Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyyMMdd-HHmmss') + '.json', raw, 'application/json');
  var files = [], it = bf.getFiles();
  while (it.hasNext()) files.push(it.next());
  files.sort(function (a, b) { return b.getName() < a.getName() ? -1 : 1; });
  for (var i = KEEP_BACKUPS; i < files.length; i++) files[i].setTrashed(true);
}
function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
