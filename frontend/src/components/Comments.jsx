import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, Send, Edit2, Trash2, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import './Comments.css';

function Comments({ videoId }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [authorName, setAuthorName] = useState('');
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [expandedComments, setExpandedComments] = useState(new Set());
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingComment, setEditingComment] = useState(null);
  const [editText, setEditText] = useState('');

  const LIMIT = 20;

  useEffect(() => {
    fetchComments();
    // Load saved author name from localStorage
    const savedName = localStorage.getItem('commentAuthorName');
    if (savedName) setAuthorName(savedName);
  }, [videoId]);

  const fetchComments = async (loadMore = false) => {
    try {
      const currentOffset = loadMore ? offset : 0;
      const response = await axios.get(`/api/video/${videoId}/comments`, {
        params: { limit: LIMIT, offset: currentOffset }
      });
      
      if (loadMore) {
        setComments(prev => [...prev, ...response.data.comments]);
      } else {
        setComments(response.data.comments);
      }
      
      setTotal(response.data.total);
      setOffset(currentOffset + response.data.comments.length);
      setHasMore(currentOffset + response.data.comments.length < response.data.total);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReplies = async (commentId) => {
    try {
      const response = await axios.get(`/api/comments/${commentId}/replies`);
      
      // Update the comment with its replies
      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return { ...comment, replies: response.data };
        }
        return comment;
      }));
      
      setExpandedComments(prev => new Set([...prev, commentId]));
    } catch (error) {
      console.error('Failed to fetch replies:', error);
    }
  };

  const handleSubmit = async (e, parentId = null) => {
    e.preventDefault();
    
    if (!authorName.trim() || !newComment.trim()) {
      alert('Please enter your name and comment');
      return;
    }

    try {
      // Save author name to localStorage
      localStorage.setItem('commentAuthorName', authorName);
      
      const response = await axios.post(`/api/video/${videoId}/comments`, {
        author_name: authorName,
        comment_text: newComment,
        parent_id: parentId
      });

      if (parentId) {
        // Add reply to parent comment
        setComments(prev => prev.map(comment => {
          if (comment.id === parentId) {
            const replies = comment.replies || [];
            return { ...comment, replies: [...replies, response.data] };
          }
          return comment;
        }));
        setReplyingTo(null);
      } else {
        // Add new top-level comment
        setComments(prev => [response.data, ...prev]);
        setTotal(prev => prev + 1);
      }

      setNewComment('');
    } catch (error) {
      console.error('Failed to post comment:', error);
      alert('Failed to post comment');
    }
  };

  const handleEdit = async (commentId) => {
    try {
      await axios.put(`/api/comments/${commentId}`, {
        comment_text: editText
      });

      // Update comment in state
      const updateComment = (comment) => {
        if (comment.id === commentId) {
          return { ...comment, comment_text: editText, is_edited: 1 };
        }
        return comment;
      };

      setComments(prev => prev.map(comment => {
        if (comment.id === commentId) {
          return updateComment(comment);
        }
        if (comment.replies) {
          return {
            ...comment,
            replies: comment.replies.map(updateComment)
          };
        }
        return comment;
      }));

      setEditingComment(null);
      setEditText('');
    } catch (error) {
      console.error('Failed to edit comment:', error);
    }
  };

  const handleDelete = async (commentId, parentId = null) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      await axios.delete(`/api/comments/${commentId}`);

      if (parentId) {
        // Remove reply from parent
        setComments(prev => prev.map(comment => {
          if (comment.id === parentId) {
            return {
              ...comment,
              replies: comment.replies.filter(r => r.id !== commentId),
              reply_count: comment.reply_count - 1
            };
          }
          return comment;
        }));
      } else {
        // Remove top-level comment
        setComments(prev => prev.filter(c => c.id !== commentId));
        setTotal(prev => prev - 1);
      }
    } catch (error) {
      console.error('Failed to delete comment:', error);
    }
  };

  const toggleReplies = (commentId) => {
    if (expandedComments.has(commentId)) {
      setExpandedComments(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    } else {
      fetchReplies(commentId);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    
    return date.toLocaleDateString();
  };

  const CommentItem = ({ comment, isReply = false, parentId = null }) => {
    const isEditing = editingComment === comment.id;
    const isReplying = replyingTo === comment.id;
    const isExpanded = expandedComments.has(comment.id);

    return (
      <div className={`comment-item ${isReply ? 'reply' : ''}`}>
        <div className="comment-header">
          <span className="comment-author">{comment.author_name}</span>
          <span className="comment-date">
            {formatDate(comment.created_at)}
            {comment.is_edited && <span className="edited-label"> (edited)</span>}
          </span>
        </div>
        
        {isEditing ? (
          <div className="comment-edit-form">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Edit your comment..."
              rows="3"
            />
            <div className="edit-actions">
              <button onClick={() => handleEdit(comment.id)} className="save-button">
                Save
              </button>
              <button onClick={() => {
                setEditingComment(null);
                setEditText('');
              }} className="cancel-button">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="comment-text">{comment.comment_text}</p>
        )}
        
        <div className="comment-actions">
          {!isReply && (
            <button onClick={() => setReplyingTo(comment.id)} className="reply-button">
              <Reply size={14} /> Reply
            </button>
          )}
          
          <button onClick={() => {
            setEditingComment(comment.id);
            setEditText(comment.comment_text);
          }} className="edit-button">
            <Edit2 size={14} /> Edit
          </button>
          
          <button onClick={() => handleDelete(comment.id, parentId)} className="delete-button">
            <Trash2 size={14} /> Delete
          </button>
          
          {!isReply && comment.reply_count > 0 && (
            <button onClick={() => toggleReplies(comment.id)} className="toggle-replies">
              {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              {comment.reply_count} {comment.reply_count === 1 ? 'reply' : 'replies'}
            </button>
          )}
        </div>
        
        {isReplying && (
          <form onSubmit={(e) => handleSubmit(e, comment.id)} className="reply-form">
            <input
              type="text"
              value={authorName}
              onChange={(e) => setAuthorName(e.target.value)}
              placeholder="Your name"
              required
            />
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Write a reply..."
              rows="2"
              required
            />
            <div className="form-actions">
              <button type="submit">Post Reply</button>
              <button type="button" onClick={() => setReplyingTo(null)}>Cancel</button>
            </div>
          </form>
        )}
        
        {isExpanded && comment.replies && (
          <div className="replies">
            {comment.replies.map(reply => (
              <CommentItem 
                key={reply.id} 
                comment={reply} 
                isReply={true} 
                parentId={comment.id}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return <div className="comments-loading">Loading comments...</div>;
  }

  return (
    <div className="comments-section">
      <h2 className="comments-header">
        <MessageCircle size={24} />
        <span>Comments ({total})</span>
      </h2>
      
      <form onSubmit={(e) => handleSubmit(e)} className="comment-form">
        <input
          type="text"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          placeholder="Your name"
          required
        />
        <textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment..."
          rows="3"
          required
        />
        <button type="submit" className="submit-button">
          <Send size={16} />
          <span>Post Comment</span>
        </button>
      </form>
      
      <div className="comments-list">
        {comments.map(comment => (
          <CommentItem key={comment.id} comment={comment} />
        ))}
      </div>
      
      {hasMore && (
        <button onClick={() => fetchComments(true)} className="load-more-button">
          Load More Comments
        </button>
      )}
      
      {comments.length === 0 && (
        <p className="no-comments">No comments yet. Be the first to comment!</p>
      )}
    </div>
  );
}

export default Comments;