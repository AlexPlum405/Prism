import { basename } from '../services';
import { useI18n } from '../../i18n';

interface RecentFilesProps {
  recentFiles: string[];
  onFileClick: (path: string) => void;
}

export function RecentFiles({ recentFiles, onFileClick }: RecentFilesProps) {
  const { t } = useI18n();
  if (recentFiles.length === 0) {
    return (
      <div style={{ padding: '16px', fontSize: '13px', opacity: 0.6, lineHeight: 1.6 }}>
        {t('workspace.recent.empty')}
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {recentFiles.map((path) => (
        <div
          key={path}
          onClick={() => onFileClick(path)}
          title={path}
          style={{
            padding: '6px 12px',
            cursor: 'pointer',
            fontSize: '13px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {basename(path)}
        </div>
      ))}
    </div>
  );
}
