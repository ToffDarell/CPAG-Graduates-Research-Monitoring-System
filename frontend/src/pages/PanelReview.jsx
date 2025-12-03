import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { FaCheckCircle, FaExclamationCircle, FaSpinner, FaFileAlt, FaDownload, FaFilePdf, FaFileWord } from 'react-icons/fa';
import { showError, showWarning } from '../utils/sweetAlert';

const PanelReview = () => {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [panelData, setPanelData] = useState(null);
  const [error, setError] = useState(null);
  const [reviewForm, setReviewForm] = useState({
    comments: '',
    recommendation: 'pending',
  });
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetchPanelData();
  }, [token]);

  const fetchPanelData = async () => {
    try {
      const res = await axios.get(`/api/panel-review/${token}`);
      setPanelData(res.data);
      if (res.data.review) {
        setReviewForm({
          comments: res.data.review.comments || '',
          recommendation: res.data.review.recommendation || 'pending',
        });
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired invitation link');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!reviewForm.comments.trim()) {
      showWarning('Validation Error', 'Please provide review comments');
      return;
    }
    if (reviewForm.recommendation === 'pending') {
      showWarning('Validation Error', 'Please select a recommendation');
      return;
    }

    setSubmitting(true);
    try {
      await axios.post(`/api/panel-review/${token}/submit`, {
        comments: reviewForm.comments,
        recommendation: reviewForm.recommendation,
      });
      setSuccess(true);
      fetchPanelData(); // Refresh to show updated status
    } catch (err) {
      showError('Error', err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <FaSpinner className="h-8 w-8 text-[#7C1D23] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading panel information...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-8 text-center">
          <FaExclamationCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-800 mb-2">Invalid Invitation</h2>
          <p className="text-gray-600">{error}</p>
          <p className="text-sm text-gray-500 mt-4">
            Please contact the Program Head if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }

  if (!panelData) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Panel Review Submission</h1>
          <p className="text-gray-600">Submit your evaluation for the research panel</p>
        </div>

        {/* Panel Information */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Panel Information</h2>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-600">Panel Name:</span>
              <p className="text-gray-900">{panelData.panel.name}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Research Title:</span>
              <p className="text-gray-900">{panelData.research?.title || 'N/A'}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Panel Type:</span>
              <p className="text-gray-900">{panelData.panel.type?.replace(/_/g, ' ')}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-600">Your Role:</span>
              <p className="text-gray-900">{panelData.panelist.role.replace(/_/g, ' ')}</p>
            </div>
            {panelData.panel.reviewDeadline && (
              <div>
                <span className="text-sm font-medium text-gray-600">Review Deadline:</span>
                <p className={`${new Date(panelData.panel.reviewDeadline) < new Date() ? 'text-red-600' : 'text-gray-900'}`}>
                  {new Date(panelData.panel.reviewDeadline).toLocaleDateString()}
                  {new Date(panelData.panel.reviewDeadline) < new Date() && ' (Overdue)'}
                </p>
              </div>
            )}
            {panelData.panel.description && (
              <div>
                <span className="text-sm font-medium text-gray-600">Description:</span>
                <p className="text-gray-900">{panelData.panel.description}</p>
              </div>
            )}
          </div>
        </div>

        {/* Panel Documents */}
        {panelData.documents && panelData.documents.length > 0 && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Panel Resources & Documents</h2>
            <p className="text-sm text-gray-600 mb-4">
              The following documents have been provided for your review. Please download and review them before submitting your evaluation.
            </p>
            <div className="space-y-3">
              {panelData.documents.map((doc) => (
                <div key={doc._id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3 flex-1">
                      {doc.mimeType === 'application/pdf' ? (
                        <FaFilePdf className="text-red-500 text-2xl" />
                      ) : (
                        <FaFileWord className="text-blue-500 text-2xl" />
                      )}
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{doc.title}</h3>
                        {doc.description && (
                          <p className="text-sm text-gray-600 mt-1">{doc.description}</p>
                        )}
                        <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                          <span>{doc.filename}</span>
                          <span>{(doc.fileSize / 1024).toFixed(2)} KB</span>
                          <span>v{doc.version}</span>
                          {doc.uploadedAt && (
                            <span>Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={async () => {
                        try {
                          const response = await axios.get(
                            `/api/panel-review/${token}/documents/${doc._id}/download`,
                            { responseType: 'blob' }
                          );
                          const url = window.URL.createObjectURL(new Blob([response.data]));
                          const link = document.createElement('a');
                          link.href = url;
                          link.setAttribute('download', doc.filename);
                          document.body.appendChild(link);
                          link.click();
                          link.remove();
                          window.URL.revokeObjectURL(url);
                        } catch (err) {
                          showError('Error', err.response?.data?.message || 'Failed to download document');
                        }
                      }}
                      className="ml-4 px-4 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors flex items-center gap-2"
                    >
                      <FaDownload />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Success Message */}
        {success && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <FaCheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800 font-medium">Review submitted successfully!</p>
            </div>
          </div>
        )}

        {/* Review Form */}
        {panelData.hasSubmittedReview ? (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Your Review</h2>
            <div className="space-y-4">
              <div>
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-800 rounded text-sm font-medium">
                  Submitted
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Recommendation:</span>
                <p className="text-gray-900 mt-1">
                  {panelData.review?.recommendation?.replace(/_/g, ' ') || 'Pending'}
                </p>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-600">Comments:</span>
                <p className="text-gray-900 mt-1 whitespace-pre-wrap">{panelData.review?.comments || 'No comments'}</p>
              </div>
              {panelData.review?.submittedAt && (
                <div>
                  <span className="text-sm font-medium text-gray-600">Submitted At:</span>
                  <p className="text-gray-900">
                    {new Date(panelData.review.submittedAt).toLocaleString()}
                  </p>
                </div>
              )}
            </div>
            <p className="mt-4 text-sm text-gray-600">
              You can update your review by submitting the form below.
            </p>
          </div>
        ) : null}

        {/* Review Submission Form */}
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">
            {panelData.hasSubmittedReview ? 'Update Review' : 'Submit Review'}
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Comments <span className="text-red-500">*</span>
              </label>
              <textarea
                value={reviewForm.comments}
                onChange={(e) => setReviewForm({ ...reviewForm, comments: e.target.value })}
                rows={8}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                placeholder="Provide your detailed review comments, feedback, and evaluation..."
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Recommendation <span className="text-red-500">*</span>
              </label>
              <select
                value={reviewForm.recommendation}
                onChange={(e) => setReviewForm({ ...reviewForm, recommendation: e.target.value })}
                className="w-full px-4 py-2 rounded-md border border-gray-300 focus:border-[#7C1D23] focus:ring-2 focus:ring-[#7C1D23]/20 text-sm"
                required
              >
                <option value="pending">Select Recommendation</option>
                <option value="approve">Approve</option>
                <option value="revision">Require Revision</option>
                <option value="reject">Reject</option>
              </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2 bg-[#7C1D23] text-white rounded-md text-sm font-medium hover:bg-[#5a1519] transition-colors disabled:opacity-60 flex items-center gap-2"
              >
                {submitting ? (
                  <>
                    <FaSpinner className="animate-spin" />
                    Submitting...
                  </>
                ) : (
                  panelData.hasSubmittedReview ? 'Update Review' : 'Submit Review'
                )}
              </button>
            </div>
          </div>
        </form>

        {/* Footer */}
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>This is a secure invitation link. Do not share it with others.</p>
        </div>
      </div>
    </div>
  );
};

export default PanelReview;

