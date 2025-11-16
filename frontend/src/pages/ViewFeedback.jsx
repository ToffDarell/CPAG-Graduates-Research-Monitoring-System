import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { FaTimes as FaClose, FaComments, FaArrowLeft } from "react-icons/fa";
import axios from "axios";
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import ErrorBoundary from '../components/ErrorBoundary';

// Configure PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';


const ViewFeedback = ({ setUser }) => {
  const { feedbackId } = useParams();
  const navigate = useNavigate();
  
  const [feedback, setFeedback] = useState(null);
  const [documentBlobUrl, setDocumentBlobUrl] = useState(null);
  const [comments, setComments] = useState([]);
  const [numPages, setNumPages] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [scale, setScale] = useState(1.0);
  const [loading, setLoading] = useState(true);
  const [loadingComments, setLoadingComments] = useState(false);
  const [error, setError] = useState(null);
  const [pdfLoaded, setPdfLoaded] = useState(false);

  useEffect(() => {
    fetchFeedbackData();
    
    // Cleanup function to revoke blob URL on unmount
    return () => {
      if (documentBlobUrl) {
        URL.revokeObjectURL(documentBlobUrl);
      }
    };
  }, [feedbackId]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchFeedbackData = async () => {
    try {
      setLoading(true);
      setError(null);
      const token = localStorage.getItem('token');
      
      console.log('[VIEW FEEDBACK] Fetching feedback data for:', feedbackId);
      
      // First, fetch feedback details
      const feedbackRes = await axios.get(`/api/student/feedback`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('[VIEW FEEDBACK] Feedback list received:', feedbackRes.data.length, 'items');

      // Find the specific feedback
      const feedbackData = feedbackRes.data.find(f => f._id === feedbackId);
      if (!feedbackData) {
        console.error('[VIEW FEEDBACK] Feedback not found in list:', feedbackId);
        throw new Error('Feedback not found');
      }

      console.log('[VIEW FEEDBACK] Feedback found:', {
        id: feedbackData._id,
        hasFile: !!feedbackData.file,
        filepath: feedbackData.file?.filepath,
        filename: feedbackData.file?.filename
      });

      setFeedback(feedbackData);

      // Only fetch file if feedback has a file
      if (feedbackData.file?.filepath || feedbackData.file) {
        try {
          console.log('[VIEW FEEDBACK] Fetching file from:', `/api/student/feedback/view/${feedbackId}`);
          const fileRes = await axios.get(`/api/student/feedback/view/${feedbackId}`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'blob'
          });

          console.log('[VIEW FEEDBACK] File received:', {
            status: fileRes.status,
            size: fileRes.data?.size,
            type: fileRes.headers['content-type']
          });

          // Create blob URL for document
          const mimeType = feedbackData.file?.mimetype || fileRes.headers['content-type'] || 'application/pdf';
          const blob = new Blob([fileRes.data], { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);
          setDocumentBlobUrl(blobUrl);
          setError(null); // Clear any previous errors
          setPdfLoaded(false); // Reset PDF loaded state when new document is set
          setNumPages(null); // Reset page count
          setPageNumber(1); // Reset to first page
        } catch (fileError) {
          console.error('[VIEW FEEDBACK] Error fetching feedback file:', fileError);
          console.error('[VIEW FEEDBACK] File error details:', {
            status: fileError.response?.status,
            statusText: fileError.response?.statusText,
            message: fileError.response?.data?.message || fileError.message,
            url: fileError.config?.url
          });
          
          // Try to parse error message if it's a blob response
          let errorMsg = 'File not found';
          if (fileError.response?.data instanceof Blob) {
            try {
              const text = await fileError.response.data.text();
              const json = JSON.parse(text);
              errorMsg = json.message || errorMsg;
            } catch (parseError) {
              errorMsg = `Server error (${fileError.response?.status}): ${fileError.response?.statusText}`;
            }
          } else if (fileError.response?.data?.message) {
            errorMsg = fileError.response.data.message;
          } else if (fileError.message) {
            errorMsg = fileError.message;
          }
          
          // Don't throw - allow page to load even if file fails
          setError(`Document not available: ${errorMsg}`);
        }
      } else {
        console.log('[VIEW FEEDBACK] No file attached to feedback');
        setError('No file attached to this feedback');
      }

      // Fetch comments (even if file failed)
      await fetchComments();
    } catch (error) {
      console.error('[VIEW FEEDBACK] Error fetching feedback:', error);
      console.error('[VIEW FEEDBACK] Error details:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        url: error.config?.url
      });
      setError(error.response?.data?.message || error.message || 'Failed to load feedback');
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
      setLoadingComments(true);
      const token = localStorage.getItem('token');
      const res = await axios.get(`/api/student/feedback/${feedbackId}/comments`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setComments(res.data);
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setLoadingComments(false);
    }
  };

  const onDocumentLoadSuccess = ({ numPages }) => {
    console.log('[VIEW FEEDBACK] PDF loaded successfully:', { numPages });
    setNumPages(numPages);
    // Small delay to ensure Document's internal state is fully ready
    setTimeout(() => {
      setPdfLoaded(true);
      setPageNumber(1); // Reset to first page when document loads
    }, 100);
  };

  const onDocumentLoadError = (error) => {
    console.error('[VIEW FEEDBACK] PDF load error:', error);
    setError(`Failed to load PDF: ${error.message || 'Unknown error'}`);
    setPdfLoaded(false);
  };

  const handleGoBack = () => {
    navigate('/dashboard/graduate?tab=progress');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#7C1D23] mb-4"></div>
          <p className="text-gray-600">Loading feedback document...</p>
        </div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-red-600 text-5xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Feedback</h2>
          <p className="text-gray-600 mb-6">{error || 'Feedback not found'}</p>
          <button
            onClick={handleGoBack}
            className="px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors"
          >
            <FaArrowLeft className="inline mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleGoBack}
                className="p-2 text-gray-600 hover:text-[#7C1D23] hover:bg-gray-100 rounded-lg transition-colors"
                title="Go back"
              >
                <FaArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-800">
                  {feedback.file?.filename || 'Feedback Document'}
                </h1>
                <p className="text-sm text-gray-500">
                  Feedback from {feedback.adviser?.name || 'Adviser'} • {new Date(feedback.createdAt).toLocaleDateString()}
                </p>
              </div>
              {comments.length > 0 && (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  <FaComments className="text-sm" />
                  {comments.length} {comments.length === 1 ? 'comment' : 'comments'}
                </span>
              )}
            </div>
            <button
              onClick={handleGoBack}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              title="Close"
            >
              <FaClose className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Error Banner (if file failed but feedback loaded) */}
      {error && feedback && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-yellow-400 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto h-[calc(100vh-80px)] flex">
        {/* Document Viewer (Left) */}
        <div className="flex-1 p-4 overflow-auto bg-gray-100 pdf-viewer-container">
          {!documentBlobUrl ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 mb-4 text-lg">{error || 'Document not available'}</p>
                <p className="text-sm text-gray-400 mb-6">You can still view comments below</p>
                <button
                  onClick={handleGoBack}
                  className="px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors"
                >
                  <FaArrowLeft className="inline mr-2" />
                  Go Back
                </button>
              </div>
            </div>
          ) : feedback.file?.mimetype === 'application/pdf' ? (
            <div className="flex flex-col items-center">
              {/* PDF Controls */}
              <div className="mb-4 flex items-center space-x-4 bg-white p-3 rounded-lg shadow sticky top-4 z-20">
                <button
                  onClick={() => setPageNumber(prev => Math.max(1, prev - 1))}
                  disabled={pageNumber <= 1}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-700 font-medium">
                  Page {pageNumber} of {numPages || '--'}
                </span>
                <button
                  onClick={() => setPageNumber(prev => Math.min(numPages || 1, prev + 1))}
                  disabled={pageNumber >= (numPages || 1)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                >
                  Next
                </button>
                <div className="border-l border-gray-300 h-6 mx-2"></div>
                <button
                  onClick={() => setScale(prev => Math.max(0.5, prev - 0.25))}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                >
                  -
                </button>
                <span className="text-sm text-gray-700 min-w-[70px] text-center font-medium">{Math.round(scale * 100)}%</span>
                <button
                  onClick={() => setScale(prev => Math.min(2, prev + 0.25))}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm font-medium"
                >
                  +
                </button>
              </div>

              {/* PDF Document */}
              {documentBlobUrl && (
                <div className="shadow-lg bg-white rounded-lg overflow-hidden">
                  <Document
                    file={documentBlobUrl}
                    onLoadSuccess={onDocumentLoadSuccess}
                    onLoadError={onDocumentLoadError}
                    loading={
                      <div className="text-center py-16">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23] mb-2"></div>
                        <p className="text-gray-600">Loading PDF...</p>
                      </div>
                    }
                    error={
                      <div className="text-center py-16 text-red-600">
                        <p className="mb-2">Failed to load PDF</p>
                        <p className="text-sm text-gray-500">Please try again or contact support</p>
                      </div>
                    }
                  >
                    {pdfLoaded && numPages && pageNumber > 0 && pageNumber <= numPages ? (
                      <ErrorBoundary
                        fallbackMessage={`Failed to render page ${pageNumber} of ${numPages}`}
                        onRetry={() => {
                          // Reset PDF loaded state to trigger re-render
                          setPdfLoaded(false);
                          setTimeout(() => {
                            setPdfLoaded(true);
                          }, 100);
                        }}
                      >
                        <Page
                          key={`page-${pageNumber}-${documentBlobUrl}`}
                          pageNumber={pageNumber}
                          scale={scale}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          loading={
                            <div className="text-center py-8">
                              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-[#7C1D23]"></div>
                              <p className="text-gray-500 text-sm mt-2">Loading page...</p>
                            </div>
                          }
                          error={
                            <div className="text-center py-8 text-red-600">
                              <p className="text-sm">Failed to load page {pageNumber}</p>
                            </div>
                          }
                        />
                      </ErrorBoundary>
                    ) : pdfLoaded && numPages ? (
                      <div className="text-center py-8 text-gray-500">
                        <p className="text-sm">Invalid page number. Please select a valid page.</p>
                      </div>
                    ) : null}
                  </Document>
                </div>
              )}
            </div>
          ) : feedback.file?.mimetype?.startsWith('image/') ? (
            <div className="flex items-center justify-center h-full">
              {documentBlobUrl && (
                <img 
                  src={documentBlobUrl} 
                  alt={feedback.file.filename}
                  className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                />
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <p className="text-gray-500 mb-4">Document preview not available for this file type.</p>
                <button
                  onClick={() => {
                    const link = document.createElement('a');
                    link.href = documentBlobUrl;
                    link.download = feedback.file.filename;
                    link.click();
                  }}
                  className="px-6 py-2 bg-[#7C1D23] text-white rounded-md hover:bg-[#5a1519] transition-colors"
                >
                  Download Document
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Comments Panel (Right) - Read-only for students */}
        <div className="w-96 border-l border-gray-200 bg-white flex flex-col">
          <div className="p-4 border-b border-gray-200 bg-gray-50 sticky top-0 z-20">
            <h4 className="font-semibold text-gray-800 text-lg">Comments ({comments.length})</h4>
            <p className="text-xs text-gray-500 mt-1">Read-only view of faculty comments</p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingComments ? (
              <div className="text-center py-8">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[#7C1D23]"></div>
                <p className="mt-2 text-gray-500 text-sm">Loading comments...</p>
              </div>
            ) : comments.length === 0 ? (
              <div className="text-center py-12">
                <FaComments className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <p className="text-gray-500 text-sm">No comments yet.</p>
                <p className="text-xs text-gray-400 mt-2">Faculty comments will appear here</p>
              </div>
            ) : (
              comments.map((comment) => (
                <div
                  key={comment._id}
                  className={`p-4 rounded-lg border-l-4 shadow-sm ${
                    comment.resolved
                      ? 'bg-gray-50 border-gray-300'
                      : 'bg-yellow-50 border-yellow-400'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <span className="font-semibold text-sm text-gray-800">
                        {comment.createdBy?.name || 'Faculty'}
                      </span>
                      {comment.position?.pageNumber && (
                        <span className="text-xs text-gray-500 ml-2">
                          • Page {comment.position.pageNumber}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(comment.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {comment.position?.selectedText && (
                    <div className="mb-3 p-3 bg-white rounded border-l-2 border-yellow-400">
                      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Selected Text:</p>
                      <p className="text-sm text-gray-700 italic">
                        "{comment.position.selectedText}"
                      </p>
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-700 mb-2 leading-relaxed">{comment.comment}</p>
                  
                  {comment.resolved && comment.resolvedBy && (
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-xs text-green-600 font-medium">
                        ✓ Resolved by {comment.resolvedBy.name}
                      </p>
                      {comment.resolvedAt && (
                        <p className="text-xs text-gray-500 mt-1">
                          {new Date(comment.resolvedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ViewFeedback;

