import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '../../domains/settings/types';
import { useSettingsStore } from '../../domains/settings/store';
import { SettingsModal } from './SettingsModal';

vi.mock('@tauri-apps/plugin-dialog', () => ({
  ask: vi.fn(),
  message: vi.fn(),
  open: vi.fn(),
}));

vi.mock('../../domains/settings/fontService', () => ({
  BUILTIN_FONT_OPTIONS: [],
  SYSTEM_FONT_OPTIONS: [],
  deleteCustomFontFile: vi.fn(),
  importCustomFont: vi.fn(),
}));

describe('SettingsModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      ...DEFAULT_SETTINGS,
      themeRegistry: [],
      themeRegistryVersion: 0,
      setLocale: vi.fn((locale) => useSettingsStore.setState({ locale })),
      detectPandoc: vi.fn(async () => DEFAULT_SETTINGS.pandoc),
      saveSettings: vi.fn(),
    });
  });

  function openCitationSettings() {
    fireEvent.click(screen.getByRole('button', { name: /引用/ }));
  }

  it('uses grouped navigation without dropping existing settings', () => {
    render(<SettingsModal visible onClose={vi.fn()} />);

    expect(screen.getByRole('button', { name: /通用/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('默认视图')).toBeInTheDocument();
    expect(screen.queryByText('Pandoc 路径')).not.toBeInTheDocument();

    openCitationSettings();
    expect(screen.getByRole('button', { name: /引用/ })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Pandoc 路径')).toBeInTheDocument();
  });

  it('persists the interface language from general settings', () => {
    render(<SettingsModal visible onClose={vi.fn()} />);

    fireEvent.change(screen.getAllByDisplayValue('跟随系统')[0], {
      target: { value: 'ja-JP' },
    });

    expect(useSettingsStore.getState().setLocale).toHaveBeenCalledWith('ja-JP');
  });

  it('renders the pandoc detection entry in citation settings', () => {
    useSettingsStore.setState({
      pandoc: {
        path: '/opt/homebrew/bin/pandoc',
        detected: true,
        version: 'pandoc 3.2.1',
        lastCheckedAt: 123,
        lastError: '',
      },
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    expect(screen.getByRole('dialog', { name: '设置中心' })).toBeInTheDocument();
    expect(screen.getByText('Pandoc 路径')).toBeInTheDocument();
    expect(screen.getByDisplayValue('/opt/homebrew/bin/pandoc')).toBeInTheDocument();
    expect(screen.getByText('已检测 pandoc 3.2.1')).toBeInTheDocument();
  });

  it('keeps theme management inside appearance settings', () => {
    render(<SettingsModal visible onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /外观/ }));

    expect(screen.getByText('内容主题')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入主题' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '导入并应用主题' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '打开主题目录' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重新加载用户主题' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '删除当前用户主题' })).not.toBeInTheDocument();
  });

  it('shows delete theme action only for the active user theme', () => {
    useSettingsStore.setState({
      contentTheme: 'custom-paper',
      themeRegistry: [{
        id: 'custom-paper',
        name: 'Custom Paper',
        label: 'Custom Paper',
        source: 'user',
        isDark: false,
        contract: {} as any,
        directory: '/tmp/custom-paper',
        version: '1.0.0',
      }],
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /外观/ }));

    expect(screen.getByRole('button', { name: '删除当前用户主题' })).toBeEnabled();
  });

  it('shows invalid user themes as disabled options', () => {
    useSettingsStore.setState({
      themeRegistry: [{
        id: 'broken-theme',
        name: 'Broken',
        label: 'Broken（异常）',
        source: 'invalid',
        isDark: false,
        contract: {} as any,
        directory: '/tmp/broken-theme',
        error: 'theme.css 缺失',
      }],
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /外观/ }));

    expect(screen.getByRole('option', { name: /Broken（异常）/ })).toBeDisabled();
  });

  it('renders stored citation paths in export settings', () => {
    useSettingsStore.setState({
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '/tmp/chinese-gb7714.csl',
      },
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    expect(screen.getByText('参考文献文件')).toBeInTheDocument();
    expect(screen.getByLabelText('参考文献文件路径')).toHaveValue('/tmp/library.bib');
    expect(screen.getByLabelText('参考文献文件路径')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText('已配置，HTML 导出会在 Pandoc 可用时处理引用')).toBeInTheDocument();
    expect(screen.getByText('CSL 样式文件')).toBeInTheDocument();
    expect(screen.getByLabelText('CSL 样式文件路径')).toHaveValue('/tmp/chinese-gb7714.csl');
    expect(screen.getByLabelText('CSL 样式文件路径')).toHaveAttribute('aria-invalid', 'false');
    expect(screen.getByText('已配置，引用导出会优先使用该样式')).toBeInTheDocument();
    expect(screen.getByText('已配置参考文献；当前未检测到 Pandoc，导出会保留 citekey 占位并提示原因。')).toBeInTheDocument();
  });

  it('shows lightweight citation path validation hints', () => {
    useSettingsStore.setState({
      citation: {
        bibliographyPath: '/tmp/references.txt',
        cslStylePath: '/tmp/style.json',
      },
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    expect(screen.getByLabelText('参考文献文件路径')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('建议使用 .bib、.bibtex 或 .json 文件')).toBeInTheDocument();
    expect(screen.getByLabelText('CSL 样式文件路径')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('CSL 样式通常是 .csl 文件')).toBeInTheDocument();
    expect(screen.getByText('引用路径后缀需要先修正；否则导出会回退到 citekey 占位。')).toBeInTheDocument();
  });

  it('reports citation export readiness from bibliography and pandoc state', () => {
    useSettingsStore.setState({
      pandoc: {
        path: '/opt/homebrew/bin/pandoc',
        detected: true,
        version: 'pandoc 3.2.1',
        lastCheckedAt: 123,
        lastError: '',
      },
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '',
      },
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    expect(screen.getByText('引用导出状态')).toBeInTheDocument();
    expect(screen.getByText('引用导出已就绪；HTML 导出会优先尝试 Pandoc citeproc。')).toBeInTheDocument();
  });

  it('explains that CSL alone does not enable citation export', () => {
    useSettingsStore.setState({
      citation: {
        bibliographyPath: '',
        cslStylePath: '/tmp/chinese-gb7714.csl',
      },
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    expect(screen.getByText('已配置 CSL，但还需要参考文献文件才会启用引用导出。')).toBeInTheDocument();
  });

  it('updates citation paths from the settings entry', () => {
    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    fireEvent.change(screen.getByLabelText('参考文献文件路径'), {
      target: { value: ' /tmp/library.bib ' },
    });
    fireEvent.change(screen.getByLabelText('CSL 样式文件路径'), {
      target: { value: ' /tmp/apa.csl ' },
    });

    expect(useSettingsStore.getState().citation).toEqual({
      bibliographyPath: '/tmp/library.bib',
      cslStylePath: '/tmp/apa.csl',
    });
    expect(useSettingsStore.getState().saveSettings).toHaveBeenCalledTimes(2);
  });

  it('clears citation paths from the settings entry', () => {
    useSettingsStore.setState({
      citation: {
        bibliographyPath: '/tmp/library.bib',
        cslStylePath: '/tmp/chinese-gb7714.csl',
      },
    });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    fireEvent.click(screen.getByRole('button', { name: '清除参考文献文件' }));
    fireEvent.click(screen.getByRole('button', { name: '清除 CSL 样式' }));

    expect(useSettingsStore.getState().citation).toEqual({
      bibliographyPath: '',
      cslStylePath: '',
    });
    expect(screen.queryByRole('button', { name: '清除参考文献文件' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清除 CSL 样式' })).not.toBeInTheDocument();
  });

  it('runs pandoc detection from the settings entry', () => {
    const detectPandoc = vi.fn(async () => DEFAULT_SETTINGS.pandoc);
    useSettingsStore.setState({ detectPandoc });

    render(<SettingsModal visible onClose={vi.fn()} />);
    openCitationSettings();

    fireEvent.click(screen.getByRole('button', { name: '检测' }));

    expect(detectPandoc).toHaveBeenCalledTimes(1);
  });
});
