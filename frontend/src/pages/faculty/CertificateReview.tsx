import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Award, FileText, Download, Check, X, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import * as facultyApi from '../../api/faculty.api';
import { Table } from '../../components/ui/Table';
import type { Column } from '../../components/ui/Table';;
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';

export const CertificateReview: React.FC = () => {
  const queryClient = useQueryClient();
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [remarks, setRemarks] = useState<string>('');

  // Fetch pending certificates
  const { data: response, isLoading } = useQuery({
    queryKey: ['pendingCertificatesList'],
    queryFn: () => facultyApi.getPendingCertificates(),
  });

  const reviewMutation = useMutation({
    // status = approved / rejected
    mutationFn: ({ id, status, remarks }: { id: string; status: 'approved' | 'rejected'; remarks: string }) =>
      facultyApi.reviewCertificate(id, { status, remarks }),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['pendingCertificatesList'] });
      toast.success(res.message || 'Certificate status updated.');
      setReviewItem(null);
      setRemarks('');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to submit review.');
    },
  });

  const handleReviewTrigger = (item: any) => {
    setReviewItem(item);
    setRemarks(item.remarks || '');
  };

  const handleAction = (status: 'approved' | 'rejected') => {
    if (!reviewItem) return;
    reviewMutation.mutate({ id: reviewItem._id, status, remarks });
  };

  const certs = response?.data || [];

  const columns: Column<any>[] = [
    { header: 'HT Number', accessor: 'hallTicketNumber', sortable: true, sortKey: 'hallTicketNumber' },
    { header: 'Type', accessor: 'type' },
    { header: 'Title', accessor: 'title' },
    { header: 'Organization', accessor: 'issuingOrganization' },
    {
      header: 'Issue Date',
      accessor: (row) =>
        row.issueDate
          ? new Date(row.issueDate).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })
          : 'N/A',
    },
    {
      header: 'Actions',
      accessor: (row) => (
        <div className="flex items-center gap-2">
          {row.certificateUrl && (
            <a
              href={row.certificateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline mr-2"
            >
              <Download className="w-3.5 h-3.5" /> View File
            </a>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleReviewTrigger(row)}
            id={`review-cert-btn-${row._id}`}
          >
            Review
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 text-left">
      <div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-200">Certificates Approval Verification</h2>
        <p className="text-xs text-slate-400">Review and approve student-uploaded co-curricular training certificates.</p>
      </div>

      <Table
        columns={columns}
        data={certs}
        isLoading={isLoading}
        emptyMessage="No pending certificates found for review"
        id="pending-certs-table"
      />

      {/* Review Modal Dialog */}
      <Modal
        open={!!reviewItem}
        onClose={() => setReviewItem(null)}
        title="Review Student Certificate"
        size="md"
        id="cert-review-modal"
      >
        {reviewItem && (
          <div className="space-y-4 pt-2 text-left text-xs text-slate-600 dark:text-slate-400">
            <div className="grid grid-cols-2 gap-4 border-b border-slate-100 dark:border-slate-850 pb-3">
              <p><strong>Student HT:</strong> {reviewItem.hallTicketNumber}</p>
              <p><strong>Certificate Type:</strong> {reviewItem.type}</p>
              <p><strong>Title:</strong> {reviewItem.title}</p>
              <p><strong>Organization:</strong> {reviewItem.issuingOrganization || 'N/A'}</p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-350">
                Reviewer Remarks
              </label>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full px-3.5 py-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 min-h-[80px]"
                placeholder="Add audit/verification remarks..."
                id="cert-review-remarks"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <Button type="button" variant="ghost" onClick={() => setReviewItem(null)} id="cert-review-close">
                Close
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={() => handleAction('rejected')}
                isLoading={reviewMutation.isPending}
                id="cert-review-reject"
              >
                <X className="w-4 h-4 mr-1.5" /> Reject
              </Button>
              <Button
                type="button"
                variant="success"
                onClick={() => handleAction('approved')}
                isLoading={reviewMutation.isPending}
                id="cert-review-approve"
              >
                <Check className="w-4 h-4 mr-1.5" /> Approve
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
