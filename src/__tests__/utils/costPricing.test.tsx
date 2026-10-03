import { render, screen } from '@testing-library/react';
import { CostBreakdown } from '../../components/aiWorkspaceSections/CostBreakdown';
import { formatCost } from '../../utils/formatters';
import '../../i18n/config';

it('keeps the USD currency when formatting a known estimate in either UI language', () => {
  expect(formatCost(1, 'zh-CN')).toBe('US$1.00');
  expect(formatCost(1, 'en-US')).toBe('$1.00');
});

it('displays incomplete estimates with the number of requests omitted from pricing', () => {
  render(<CostBreakdown cost={1} language="zh-CN" unpricedRequests={2} />);
  expect(screen.getByText(/US\$1\.00/)).toBeInTheDocument();
  expect(screen.getByText(/2 次请求无法估价/)).toBeInTheDocument();
});

it('does not display an unpriced request as a zero cost translation', () => {
  render(<CostBreakdown cost={0} language="zh-CN" unpricedRequests={1} />);
  expect(screen.getByText(/费用未知/)).toBeInTheDocument();
  expect(screen.queryByText(/US\$0/)).not.toBeInTheDocument();
});
