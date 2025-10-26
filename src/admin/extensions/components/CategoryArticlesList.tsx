import React, { useState, useEffect } from 'react';
import { useFetchClient } from '@strapi/strapi/admin';
import {
  Box,
  Button,
  Flex,
  IconButton,
  TextInput,
  Typography,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from '@strapi/design-system';
import { Pencil, Check, Cross } from '@strapi/icons';

interface Article {
  id: number;
  documentId: string;
  title: string;
  slug: string;
}

interface CategoryArticlesListProps {
  categoryId: string | number;
  documentId?: string;
}

export const CategoryArticlesList: React.FC<CategoryArticlesListProps> = ({ categoryId, documentId }) => {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState('');
  const { get, put } = useFetchClient();

  useEffect(() => {
    fetchArticles();
  }, [categoryId]);

  const fetchArticles = async () => {
    try {
      setLoading(true);
      // Fetch articles that belong to this category
      const response = await get(`/content-manager/collection-types/api::article.article`, {
        params: {
          filters: {
            category: {
              documentId: documentId || categoryId
            }
          },
          populate: ['category'],
        }
      });

      if (response.data?.results) {
        setArticles(response.data.results);
      }
    } catch (error) {
      console.error('Error fetching articles:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (article: Article) => {
    setEditingId(article.id);
    setEditValue(article.title);
  };

  const handleSave = async (article: Article) => {
    try {
      await put(
        `/content-manager/collection-types/api::article.article/${article.documentId}`,
        {
          data: {
            title: editValue,
          }
        }
      );

      setArticles(articles.map(a =>
        a.id === article.id ? { ...a, title: editValue } : a
      ));
      setEditingId(null);
    } catch (error) {
      console.error('Error updating article:', error);
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValue('');
  };

  if (loading) {
    return <Typography variant="pi">Loading articles...</Typography>;
  }

  if (articles.length === 0) {
    return <Typography variant="pi" textColor="neutral600">No articles in this category</Typography>;
  }

  return (
    <Box padding={2}>
      <Table colCount={2} rowCount={articles.length}>
        <Thead>
          <Tr>
            <Th>
              <Typography variant="sigma">Article Title</Typography>
            </Th>
            <Th>
              <Typography variant="sigma">Actions</Typography>
            </Th>
          </Tr>
        </Thead>
        <Tbody>
          {articles.map((article) => (
            <Tr key={article.id}>
              <Td>
                {editingId === article.id ? (
                  <TextInput
                    value={editValue}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value)}
                    placeholder="Article title"
                  />
                ) : (
                  <Typography>{article.title}</Typography>
                )}
              </Td>
              <Td>
                <Flex gap={2}>
                  {editingId === article.id ? (
                    <>
                      <IconButton
                        onClick={() => handleSave(article)}
                        label="Save"
                        icon={<Check />}
                      />
                      <IconButton
                        onClick={handleCancel}
                        label="Cancel"
                        icon={<Cross />}
                      />
                    </>
                  ) : (
                    <IconButton
                      onClick={() => handleEdit(article)}
                      label="Edit"
                      icon={<Pencil />}
                    />
                  )}
                </Flex>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </Box>
  );
};
