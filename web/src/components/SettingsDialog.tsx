import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import * as Checkbox from "@radix-ui/react-checkbox";
import * as RadioGroup from "@radix-ui/react-radio-group";
import { desktop } from "../state/bridge";
import type { AquariumApi } from "../state/useAquarium";
import { Icon } from "../icons";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  aq: AquariumApi;
}

export function SettingsDialog({ open, onClose, aq }: SettingsDialogProps) {
  const prefs = aq.snapshot?.preferences;
  const [focusMinutes, setFocusMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [chime, setChime] = useState(false);

  // Initialize the draft ONLY on the open edge (false→true). The Snapshot
  // rebuilds the preferences object every tick; depending on it would clobber
  // the user's unsaved input once per second. Reopening re-reads fresh values.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current && prefs) {
      setFocusMinutes(prefs.focusMinutes);
      setBreakMinutes(prefs.breakMinutes);
      setChime(prefs.chimeEnabled);
    }
    wasOpen.current = open;
  }, [open, prefs]);

  const currentTheme = aq.snapshot?.theme || "reef-realistic";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    aq.saveSettings(focusMinutes, breakMinutes, chime ? 1 : 0, onClose);
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.target;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    void file.text().then((text) => aq.importFile(text));
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content id="settings-dialog" asChild>
          <form id="settings-form" onSubmit={handleSubmit}>
            <div className="dialog-heading"><Dialog.Title className="dialog-title">按自己的节奏来</Dialog.Title><Dialog.Close className="icon-button" aria-label="关闭设置"><Icon name="close" /></Dialog.Close></div>
            <div className="dialog-body">
              <Dialog.Description className="dialog-description">时长调整从下一轮开始，本轮计时保持不变。</Dialog.Description>

              <div className="field-grid">
                <div className="field">
                  <label htmlFor="focus-minutes">专注时长 <span>1–120 分钟</span></label>
                  <input id="focus-minutes" type="number" min={1} max={120} required value={focusMinutes} onChange={(e) => setFocusMinutes(Number(e.target.value))} />
                </div>
                <div className="field">
                  <label htmlFor="break-minutes">休息时长 <span>1–30 分钟</span></label>
                  <input id="break-minutes" type="number" min={1} max={30} required value={breakMinutes} onChange={(e) => setBreakMinutes(Number(e.target.value))} />
                </div>
              </div>

              <label className="check-row">
                <Checkbox.Root id="chime" className="checkbox-root" checked={chime} onCheckedChange={(v) => setChime(v === true)}>
                  <Checkbox.Indicator className="checkbox-indicator"><Icon name="check" size={12} /></Checkbox.Indicator>
                </Checkbox.Root>
                <span>完成时播放轻柔提示音</span>
              </label>
              <Dialog.Description className="dialog-description">电脑休眠和应用退出会暂停计时。回来时保持静音，准备好再继续。</Dialog.Description>

              <div className="dialog-themes">
                <p className="dialog-backup-title">海底皮肤</p>
                <Dialog.Description className="dialog-description">换一种配色，也是换一种心情。切换立刻生效，不会影响你的存档。</Dialog.Description>
                <div className="theme-auto-row">
                  <span id="theme-auto-label">随时间自动切换主题</span>
                  <button id="theme-auto" className="theme-auto-switch" type="button" role="switch" aria-labelledby="theme-auto-label" aria-describedby="theme-auto-description" aria-checked={!!aq.snapshot?.themeAuto} disabled={!aq.snapshot || aq.busy} onClick={() => aq.setThemeAuto(!aq.snapshot?.themeAuto)}>
                    <span className="theme-auto-thumb" />
                  </button>
                </div>
                <Dialog.Description id="theme-auto-description" className="dialog-description">按本地时间轮换：06:00 马卡龙 · 10:00 赛璐璐 · 17:00 青绿江山 · 20:00 深海写实。手动选皮肤会关闭自动切换。</Dialog.Description>
                <div className="theme-auto-row">
                  <span id="theme-shuffle-label">全部主题随机轮换</span>
                  <button id="theme-shuffle" className="theme-auto-switch" type="button" role="switch" aria-labelledby="theme-shuffle-label" aria-describedby="theme-shuffle-description" aria-checked={!!aq.snapshot?.themeShuffle} disabled={!aq.snapshot || aq.busy} onClick={() => aq.setThemeShuffle(!aq.snapshot?.themeShuffle)}>
                    <span className="theme-auto-thumb" />
                  </button>
                </div>
                <Dialog.Description id="theme-shuffle-description" className="dialog-description">开启时随机换一套，此后每 30 分钟从全部皮肤中随机切换，不连续重复。两种自动模式只能开启一种；手动选皮肤会关闭自动模式。</Dialog.Description>
                <RadioGroup.Root id="theme-list" className="theme-list" role="radiogroup" aria-label="主题" value={currentTheme} onValueChange={(id) => aq.setTheme(id)}>
                  {aq.themes.map((t) => (
                    <RadioGroup.Item key={t.id} data-theme-id={t.id} value={t.id} className="theme-option" onClick={() => { if ((aq.snapshot?.themeAuto || aq.snapshot?.themeShuffle) && t.id === currentTheme) aq.setTheme(t.id); }}>
                      <RadioGroup.Indicator className="theme-option-check" forceMount>
                        <Icon name="check" size={11} />
                      </RadioGroup.Indicator>
                      <span className="theme-option-label">{t.displayName}</span>
                    </RadioGroup.Item>
                  ))}
                </RadioGroup.Root>
              </div>

              <Dialog.Description className="dialog-feedback">遇到问题或有建议？<a href="https://github.com/echoVic/little-reef/issues/new" target="_blank" rel="noopener noreferrer">在 GitHub 告诉我们</a>
                {desktop && <> · <button id="check-update" className="link-button" type="button" onClick={aq.checkUpdate}>检查更新</button></>}
              </Dialog.Description>

              <div className="dialog-backup">
                <p className="dialog-backup-title">备份与恢复</p>
                <Dialog.Description className="dialog-description">导出一份存档放在外面；换电脑或重装时，可以随时恢复。</Dialog.Description>
                <div className="dialog-backup-actions">
                  <button id="backup-export" className="subtle-button" type="button" onClick={aq.exportArchive}>导出存档…</button>
                  <button id="backup-import" className="subtle-button" type="button" onClick={() => (desktop ? aq.importArchive() : document.getElementById("backup-file")?.click())}>导入存档…</button>
                </div>
              </div>
              <input type="file" id="backup-file" accept=".json" hidden onChange={onFile} />
            </div>
            <div className="dialog-footer">
              <button className="primary-button" type="submit">保存设置</button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
