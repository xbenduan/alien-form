import { EllipsisOutlined } from '@ant-design/icons';
import { Button, Dropdown, Space, message } from 'antd';
import { useMemo, useState } from 'react';
import { ColumnVisibilityModal } from './ColumnVisibilityModal';

interface RecordToolbarActionsProps {
  singularLabel: string;
  tableFieldOptions: Array<{ label: string; value: string }>;
  tableVisibleKeys: string[];
  onOpenAdd: () => void;
  onChangeTableVisibleKeys: (values: string[]) => void;
  onResetTableVisibleKeys: () => void;
}

export function RecordToolbarActions({
  singularLabel,
  tableFieldOptions,
  tableVisibleKeys,
  onOpenAdd,
  onChangeTableVisibleKeys,
  onResetTableVisibleKeys,
}: RecordToolbarActionsProps) {
  const [columnModalOpen, setColumnModalOpen] = useState(false);
  const menu = useMemo(
    () => ({
      items: [
        { key: 'columns', label: '自定义列' },
        { key: 'import', label: '导入（开发中）' },
        { key: 'export', label: '导出（开发中）' },
      ],
      onClick: ({ key }: { key: string }) => {
        if (key === 'columns') {
          setColumnModalOpen(true);
          return;
        }

        message.info('开发中');
      },
    }),
    [],
  );

  return (
    <>
      <Space.Compact>
        <Button type="primary" size="large" className="model-add-button" onClick={onOpenAdd}>
          新增{singularLabel}
        </Button>
        <Dropdown menu={menu} placement="bottomRight">
          <Button size="large" icon={<EllipsisOutlined />} aria-label="更多操作" />
        </Dropdown>
      </Space.Compact>
      <ColumnVisibilityModal
        open={columnModalOpen}
        options={tableFieldOptions}
        values={tableVisibleKeys}
        onChange={onChangeTableVisibleKeys}
        onReset={onResetTableVisibleKeys}
        onClose={() => setColumnModalOpen(false)}
      />
    </>
  );
}
